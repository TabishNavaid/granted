/**
 * The drawings. Every one is a watercolor by Mary Vaux Walcott (1860 to
 * 1940) from the Smithsonian American Art Museum, released as CC0 through
 * Smithsonian Open Access, cut out of its paper by scripts/clean-drawing and
 * saved to public/drawings at 2x. Credits are in public/drawings/CREDITS.md
 * and on /drawings-review.
 *
 * They are framing accents only: a strip of wildflowers along the bottom of
 * the landing hero and above the footer, one small plant beside a few
 * landing headings, the Funded screen, and the small flower that opens for a
 * moment when something is approved. Nothing inside the product is drawn.
 */

import { drawings } from "./drawings.manifest";

export type DrawingKind = "plant" | "flower";

export interface DrawingCredit {
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl?: string;
}

export interface DrawingAsset {
  slug: string;
  kind: DrawingKind;
  /** Public path without the extension; .png and .webp both exist. */
  file: string;
  /** CSS pixels (half of the 2x file). */
  width: number;
  height: number;
  /**
   * Flowers only: where the flower heads end, as a fraction of the height
   * from the top, and the point they open from. Below the line is stem.
   */
  head?: { bottom: number; x: number; y: number };
  description: string;
  credit: DrawingCredit;
}

export { drawings };

export const plants = drawings.filter((d) => d.kind === "plant");
export const flowers = drawings.filter((d) => d.kind === "flower");

export function drawing(slug: string): DrawingAsset {
  const d = drawings.find((x) => x.slug === slug);
  if (!d) throw new Error(`No drawing called ${slug}`);
  return d;
}

/** A small stable hash, so the same item always gets the same flower. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The flower that opens when this item is approved. */
export function flowerFor(id: string): DrawingAsset {
  return flowers[hash(id) % flowers.length];
}

/**
 * The order plants stand in along a strip: tall and short, cool and warm,
 * alternating so no two neighbors look alike.
 */
const strip = ["death-camas", "lupine-blue", "harebell", "wind-poppy", "yarrow", "camas", "aster", "paintbrush", "wild-hyacinth", "phlox"];

/** Plants for a strip of meadow, starting at a stable offset so two strips never match. */
export function meadowPlants(count: number, seed = "meadow"): DrawingAsset[] {
  const order = strip.map((slug) => plants.find((p) => p.slug === slug)).filter((p): p is DrawingAsset => Boolean(p));
  const start = hash(seed) % order.length;
  return Array.from({ length: count }, (_, i) => order[(start + i) % order.length]);
}

/** A stable pseudo-random number in [0, 1) for layout jitter. */
export function jitter(seed: string, i: number) {
  return (hash(`${seed}:${i}`) % 10000) / 10000;
}
