#!/usr/bin/env node
/**
 * clean-drawing: turns a drawing or watercolor photographed or scanned on
 * paper into a cut-out that sits on any page.
 *
 * For every entry in scripts/drawings.json it:
 *   1. downloads the original from its source into .cache/drawings (once),
 *   2. crops to the entry's box, if it has one, erases what is written on
 *      the sheet (a painter's pencil label, a signature), and fades cropped
 *      edges out where an entry asks,
 *   3. flattens the paper: estimates the paper's own color and shading across
 *      the sheet and divides it out, so the paper reads as pure white,
 *   4. removes the white: "color to alpha" against white, so thin washes and
 *      the paper showing through them become transparent and the painting
 *      keeps its softness instead of being cut out with a hard edge,
 *   5. drops stray marks that belong to the rest of the sheet (a ground line,
 *      pencil, a neighbor's color), by hue or by grayness,
 *   6. recolors toward the palette where an entry asks (each color to a
 *      palette fill, a dark outline to the darker shade of that fill), or
 *      just softens hue, saturation, and lightness so the set sits calmly
 *      next to the interface,
 *   7. trims to the drawing, resizes to twice its CSS size, and
 *   8. writes an optimized PNG and WebP to public/drawings/.
 *
 * It then regenerates src/lib/drawings.manifest.ts and
 * public/drawings/CREDITS.md from the same entries, so the credits and the
 * files can never drift apart.
 *
 *   npm run drawings              # process everything
 *   npm run drawings -- lupine    # only these slugs
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, ".cache", "drawings");
const outDir = path.join(root, "public", "drawings");
const plateDir = path.join(root, "public", "art");
const config = JSON.parse(await readFile(path.join(root, "scripts", "drawings.json"), "utf8"));
const only = new Set(process.argv.slice(2));

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 granted-clean-drawing";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchSource(entry) {
  const ext = path.extname(new URL(entry.download).pathname).toLowerCase() || ".jpg";
  const file = path.join(cacheDir, `${entry.source ?? entry.slug}${ext}`);
  if (await exists(file)) return file;
  await mkdir(cacheDir, { recursive: true });
  const res = await fetch(entry.download, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${entry.slug}: download failed (${res.status}) from ${entry.download}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/* ---------- color helpers ---------- */

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const clamp = (v, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);

/** Whether hue h falls in [from, to], wrapping past 360 (so [330, 30] is the reds). */
function inHue(h, [from, to]) {
  return from <= to ? h >= from && h <= to : h >= from || h <= to;
}

function hexHsl(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/* ---------- paper estimate ---------- */

/**
 * The paper's color at every pixel: shrink the sheet a lot, keep the
 * brightest pixel in each neighborhood (crayon is darker than paper, so this
 * keeps the paper and drops the strokes), then blow it back up smoothly.
 */
async function paperMap(input, width, height) {
  const small = Math.max(8, Math.round(Math.max(width, height) / 24));
  const sw = width >= height ? small : Math.max(4, Math.round((small * width) / height));
  const sh = height > width ? small : Math.max(4, Math.round((small * height) / width));
  const { data } = await sharp(input).resize(sw, sh, { fit: "fill", kernel: "cubic" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  const r = 2;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let best = 0;
      let bi = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(sw - 1, Math.max(0, x + dx));
          const yy = Math.min(sh - 1, Math.max(0, y + dy));
          const i = (yy * sw + xx) * 3;
          const lum = data[i] + data[i + 1] + data[i + 2];
          if (lum > best) {
            best = lum;
            bi = i;
          }
        }
      }
      const o = (y * sw + x) * 3;
      out[o] = data[bi];
      out[o + 1] = data[bi + 1];
      out[o + 2] = data[bi + 2];
    }
  }
  const { data: big } = await sharp(out, { raw: { width: sw, height: sh, channels: 3 } })
    .blur(1.2)
    .resize(width, height, { fit: "fill", kernel: "cubic" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return big;
}

/* ---------- one drawing ---------- */

async function clean(entry) {
  const src = await fetchSource(entry);
  let img = sharp(src).rotate().flatten({ background: "#ffffff" });
  const meta = await sharp(src).metadata();
  // A crop is either pixels [left, top, width, height] or fractions of the sheet [x0, y0, x1, y1].
  let box = entry.crop ?? null;
  if (entry.cropFrac) {
    const [x0, y0, x1, y1] = entry.cropFrac;
    box = [Math.round(x0 * meta.width), Math.round(y0 * meta.height), Math.round((x1 - x0) * meta.width), Math.round((y1 - y0) * meta.height)];
  }
  if (box) {
    const [left, top, width, height] = box;
    img = img.extract({ left, top, width, height });
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const paper = await paperMap(await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer(), width, height);

  const cutoff = entry.cutoff ?? 0.1; // how faint a mark has to be before it counts as paper
  const gain = entry.gain ?? 1; // >1 makes thin pigment read a little stronger
  const t = entry.tone ?? {};
  const drops = entry.drop ?? [];
  const recolor = entry.recolor;
  const rgba = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let p = 0, q = 0; p < width * height; p++, q += 3) {
    // 1. flatten the paper to white
    let r = clamp((data[q] / Math.max(1, paper[q])) * 255);
    let g = clamp((data[q + 1] / Math.max(1, paper[q + 1])) * 255);
    let b = clamp((data[q + 2] / Math.max(1, paper[q + 2])) * 255);

    // Keep the color as it looks on paper, for drawings meant to sit on the dark ink band.
    const seen = entry.onDark ? [r, g, b] : null;

    // 2. color to alpha against white
    let a = Math.max(255 - r, 255 - g, 255 - b) / 255;
    a = clamp(((a - cutoff) / (1 - cutoff)) * gain, 0, 1);
    if (a > 0) {
      const raw = Math.max(255 - r, 255 - g, 255 - b) / 255;
      r = clamp(255 - (255 - r) / raw);
      g = clamp(255 - (255 - g) / raw);
      b = clamp(255 - (255 - b) / raw);
    }

    // 3. drop marks that are not part of this drawing (a ground line, pencil, a neighbor's color)
    if (a > 0 && drops.length) {
      const [h, sat, l] = rgbToHsl(r, g, b);
      const dropped = (d) => {
        if (d.gray) return sat < (d.maxSat ?? 0.22) && l > (d.minL ?? 0.3);
        if (d.dark) return l <= (d.maxL ?? 0.25);
        return inHue(h, d.hue) && sat >= (d.minSat ?? 0.15) && l >= (d.minL ?? 0);
      };
      if (drops.some(dropped)) a = 0;
    }

    // 4. recolor toward the palette: each crayon color to a palette fill, and
    //    the dark outline to the darker shade of that fill
    if (a > 0 && recolor) {
      const [h, sat, l] = rgbToHsl(r, g, b);
      if (recolor.dark && l <= (recolor.dark.maxL ?? 0.22)) {
        const [dh, ds, dl] = hexHsl(recolor.dark.color);
        [r, g, b] = hslToRgb(dh, ds, clamp(dl + (l - 0.1) * 0.5, 0, 1));
      } else {
        const rule = (recolor.rules ?? []).find((x) => inHue(h, x.hue) && sat >= (x.minSat ?? 0.2));
        if (rule) {
          const [fh, fs, fl] = hexHsl(rule.fill);
          [r, g, b] = hslToRgb(fh, fs, clamp(fl + (l - (rule.ref ?? 0.45)) * (rule.spread ?? 0.6), 0.05, 0.95));
        }
      }
    }

    // On dark, show the paint as it looks on paper, held a little more firmly.
    if (seen && a > 0) {
      [r, g, b] = seen;
      a = clamp(a * (entry.darkGain ?? 2.2), 0, 1);
    }

    // 5. or just a light nudge of hue, saturation, and lightness
    if (a > 0 && (t.hue || t.saturation || t.lightness)) {
      let [h, sat, l] = rgbToHsl(r, g, b);
      h += t.hue ?? 0;
      sat = clamp(sat * (t.saturation ?? 1), 0, 1);
      l = clamp(l + (t.lightness ?? 0), 0, 1);
      [r, g, b] = hslToRgb(h, sat, l);
    }

    const o = p * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = Math.round(a * 255);

    if (a > 0.12) {
      const x = p % width;
      const y = (p - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  // Erase what is written on the sheet (the painter's pencil label, a signature, a catalog number).
  // Rectangles are fractions of the whole sheet.
  if (entry.erase?.length) {
    const ox = box ? box[0] : 0;
    const oy = box ? box[1] : 0;
    minX = width;
    minY = height;
    maxX = -1;
    maxY = -1;
    const rects = entry.erase.map(([x0, y0, x1, y1]) => [x0 * meta.width - ox, y0 * meta.height - oy, x1 * meta.width - ox, y1 * meta.height - oy]);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        if (rects.some(([a0, b0, a1, b1]) => x >= a0 && x < a1 && y >= b0 && y < b1)) rgba[o + 3] = 0;
        if (rgba[o + 3] > 30) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) throw new Error(`${entry.slug}: nothing left after removing the paper`);

  // Fade a cropped edge out, so a stem cut by the crop dissolves the way a
  // field sketch trails off instead of ending in a hard straight line.
  // Each side is a fraction of the crop's width or height.
  if (entry.feather) {
    const { top = 0, left = 0, right = 0, bottom = 0 } = entry.feather;
    const ease = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let f = 1;
        if (top) f *= ease(Math.min(1, y / (top * height)));
        if (bottom) f *= ease(Math.min(1, (height - 1 - y) / (bottom * height)));
        if (left) f *= ease(Math.min(1, x / (left * width)));
        if (right) f *= ease(Math.min(1, (width - 1 - x) / (right * width)));
        if (f < 1) {
          const o = (y * width + x) * 4 + 3;
          rgba[o] = Math.round(rgba[o] * f);
        }
      }
    }
  }

  // Tighten the box to rows and columns that really hold paint, so a stray
  // speck or the edge of the scan does not hold the trim open.
  {
    const rows = new Uint32Array(height);
    const cols = new Uint32Array(width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rgba[(y * width + x) * 4 + 3] > 70) {
          rows[y]++;
          cols[x]++;
        }
      }
    }
    const minRow = Math.max(3, Math.round(width * 0.004));
    const minCol = Math.max(3, Math.round(height * 0.004));
    const first = (arr, min) => arr.findIndex((v) => v >= min);
    const last = (arr, min) => arr.length - 1 - [...arr].reverse().findIndex((v) => v >= min);
    const y0 = first(rows, minRow);
    const x0 = first(cols, minCol);
    if (y0 >= 0 && x0 >= 0) {
      minY = Math.max(minY, y0);
      maxY = Math.min(maxY, last(rows, minRow));
      minX = Math.max(minX, x0);
      maxX = Math.min(maxX, last(cols, minCol));
    }
  }

  // trim, with a little air so grain at the edge is not clipped
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02) + 2;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cw = Math.min(width, maxX + pad + 1) - left;
  const ch = Math.min(height, maxY + pad + 1) - top;

  // twice the CSS size, never upscaled past the original
  const cssHeight = entry.height;
  const outH = Math.min(cssHeight * 2, ch);
  const outW = Math.round((cw * outH) / ch);
  const cut = sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cw, height: ch })
    .resize(outW, outH, { kernel: "lanczos3" });

  await mkdir(outDir, { recursive: true });
  const base = path.join(outDir, entry.slug);
  await cut.clone().png({ compressionLevel: 9, palette: true, quality: 92, effort: 10, dither: 0.6 }).toFile(`${base}.png`);
  await cut.clone().webp({ quality: 72, alphaQuality: 70, effort: 6, smartSubsample: true }).toFile(`${base}.webp`);

  const cssW = Math.round(outW / 2);
  const cssH = Math.round(outH / 2);
  console.log(`${entry.slug.padEnd(22)} ${outW}x${outH} (css ${cssW}x${cssH}) from ${width}x${height}${outH < cssHeight * 2 ? "  [source smaller than 2x, kept at native size]" : ""}`);
  return { ...entry, width: cssW, height: cssH };
}

/* ---------- manifest and credits ---------- */

function manifestTs(entries, plates) {
  const items = entries.map((e) => {
    const asset = {
      slug: e.slug,
      kind: e.kind,
      file: `/drawings/${e.slug}`,
      width: e.width,
      height: e.height,
      ...(e.color ? { color: e.color } : {}),
      ...(e.head ? { head: e.head } : {}),
      description: e.description,
      credit: e.credit,
    };
    return `  ${JSON.stringify(asset, null, 2).replace(/\n/g, "\n  ")}`;
  });
  return `// Generated by scripts/clean-drawing.mjs from scripts/drawings.json. Edit that file and run \`npm run drawings\`.
import type { DrawingAsset, PlateAsset } from "./drawings";

export const drawings: DrawingAsset[] = [
${items.join(",\n")},
];

export const plates: PlateAsset[] = [
${plates.map((p) => `  ${JSON.stringify({ slug: p.slug, file: `/art/${p.slug}`, width: p.width, height: p.height, plant: p.plant, latin: p.latin, year: p.year, medium: p.medium, collection: p.collection, alt: p.alt, credit: p.credit }, null, 2).replace(/\n/g, "\n  ")}`).join(",\n")},
];
`;
}

function creditsMd(entries, plates) {
  const rows = entries.map(
    (e) =>
      `| \`${e.slug}\` | ${e.description} | ${e.credit.title.replace(/\|/g, "/")} | ${e.credit.author} | ${e.credit.sourceUrl} | ${e.credit.licenseUrl ? `[${e.credit.license}](${e.credit.licenseUrl})` : e.credit.license} |`,
  );
  const sources = [...new Map(entries.map((e) => [e.credit.sourceUrl, e])).values()];
  return `# Drawing credits

Every drawing in the product is a watercolor by Mary Vaux Walcott (1860 to 1940), held by the Smithsonian American Art Museum and released as CC0 through Smithsonian Open Access. Each record was checked before use: the museum page marks the image \"Free to use\" with the CC0 badge, and the Smithsonian Open Access API lists its usage as CC0. CC0 allows commercial use without permission or attribution; the credit below is given anyway. None of the reference images used to set the direction are shipped.

The files here are produced by \`scripts/clean-drawing.mjs\` from \`scripts/drawings.json\`: the paper is removed to transparency, the painter's pencil label is erased, color is softened slightly so the paintings sit calmly next to the interface, and each is trimmed and saved at 2x as PNG and WebP. Two files can come from one sheet.

| File | What it is | Source title | Author | Source page | License |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## Paintings shown whole

${plates.length ? plates.map((p) => `- \`public/art/${p.slug}\`: ${p.plant} (${p.latin}), ${p.year}, ${p.medium}. ${p.credit.author}. ${p.collection}. ${p.credit.sourceUrl}. License: ${p.credit.license}. Shown uncut, paper and pencil notes included, scan margin trimmed.`).join("\n") : "None."}

## Sources

${sources.map((e) => `- **${e.credit.title}** by ${e.credit.author}. ${e.credit.sourceUrl}. License: ${e.credit.license}${e.credit.licenseUrl ? ` (${e.credit.licenseUrl})` : ""}.`).join("\n")}

## Considered and set aside

${(config.considered ?? []).map((c) => `- ${c}`).join("\n")}

## Adding or swapping a drawing

1. Prefer another Mary Vaux Walcott plate from the Smithsonian American Art Museum so the set stays in one hand. Otherwise use CC0, public domain, or the Pixabay Content License, confirmed on the source page. No watermarks, no stock sites, no unclear licenses, nothing marked AI generated.
2. Add an entry to \`scripts/drawings.json\` with the download URL, an optional crop box, and the credit exactly as the source page states it.
3. Run \`npm run drawings\`. This file and \`src/lib/drawings.manifest.ts\` are rewritten.
`;
}

/* ---------- plates: whole sheets shown as paintings, paper and all ---------- */

async function plate(entry) {
  const src = await fetchSource(entry);
  const meta = await sharp(src).metadata();
  const [x0, y0, x1, y1] = entry.cropFrac ?? [0, 0, 1, 1];
  const box = { left: Math.round(x0 * meta.width), top: Math.round(y0 * meta.height), width: Math.round((x1 - x0) * meta.width), height: Math.round((y1 - y0) * meta.height) };
  const outW = Math.min(entry.width * 2, box.width);
  const img = sharp(src).rotate().extract(box).resize({ width: outW, kernel: "lanczos3" });
  await mkdir(plateDir, { recursive: true });
  const base = path.join(plateDir, entry.slug);
  const info = await img.clone().webp({ quality: 86, effort: 6 }).toFile(`${base}.webp`);
  await img.clone().jpeg({ quality: 86, mozjpeg: true }).toFile(`${base}.jpg`);
  console.log(`${entry.slug.padEnd(22)} plate ${info.width}x${info.height}`);
  return { ...entry, width: Math.round(info.width / 2), height: Math.round(info.height / 2) };
}

const results = [];
for (const entry of config.drawings) {
  if (only.size && !only.has(entry.slug)) {
    const prior = await sharp(path.join(outDir, `${entry.slug}.png`)).metadata().catch(() => null);
    if (!prior) throw new Error(`${entry.slug} has not been processed yet; run without a filter first`);
    results.push({ ...entry, width: Math.round(prior.width / 2), height: Math.round(prior.height / 2) });
    continue;
  }
  results.push(await clean(entry));
}
const plates = [];
for (const entry of config.plates ?? []) plates.push(await plate(entry));
await writeFile(path.join(root, "src", "lib", "drawings.manifest.ts"), manifestTs(results, plates));
await writeFile(path.join(outDir, "CREDITS.md"), creditsMd(results, plates));
console.log(`\nWrote ${results.length} drawings, ${plates.length} plates, src/lib/drawings.manifest.ts, and public/drawings/CREDITS.md`);
