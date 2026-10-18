/**
 * The crayon drawings. Every one is a real drawing found online under a
 * license that allows commercial use, cut out of its paper by
 * scripts/clean-drawing and saved to public/drawings at 2x. Credits are in
 * public/drawings/CREDITS.md and on /drawings-review.
 */

import { drawings } from "./drawings.manifest";

export type Crayon = "grass" | "corn" | "petal" | "poppy" | "marigold";
export type DrawingKind = "flower" | "grass" | "sun" | "seedling";

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
  /** The crayon it reads as, for picking a different color each time. */
  color?: Crayon;
  /**
   * Flowers only: where the head ends, as a fraction of the height from the
   * top, and the point the petals open from. Below the line is stem.
   */
  head?: { bottom: number; x: number; y: number };
  description: string;
  credit: DrawingCredit;
}

export { drawings };

export const flowers = drawings.filter((d) => d.kind === "flower");
export const grassStrips = drawings.filter((d) => d.kind === "grass");

export function drawing(slug: string): DrawingAsset {
  const d = drawings.find((x) => x.slug === slug);
  if (!d) throw new Error(`No drawing called ${slug}`);
  return d;
}

/** A small stable hash, so the same item always grows the same flower. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The flower that grows for this item. */
export function flowerFor(id: string): DrawingAsset {
  return flowers[hash(id) % flowers.length];
}

/**
 * Flowers for a meadow, in an order where no two neighbors share a color,
 * starting from a stable offset so each meadow looks a little different.
 */
export function meadowFlowers(count: number, seed = "meadow"): DrawingAsset[] {
  const byColor = new Map<string, DrawingAsset[]>();
  for (const f of flowers) {
    const key = f.color ?? f.slug;
    byColor.set(key, [...(byColor.get(key) ?? []), f]);
  }
  const groups = [...byColor.values()];
  const start = hash(seed) % Math.max(groups.length, 1);
  const out: DrawingAsset[] = [];
  for (let i = 0; i < count; i++) {
    const g = groups[(start + i) % groups.length];
    out.push(g[Math.floor(i / groups.length) % g.length]);
  }
  return out;
}

/** A stable pseudo-random number in [0, 1) for layout jitter. */
export function jitter(seed: string, i: number) {
  return (hash(`${seed}:${i}`) % 10000) / 10000;
}

/** The first drawing of a kind, if the set has one. */
export function drawingOf(kind: DrawingKind): DrawingAsset | undefined {
  return drawings.find((d) => d.kind === kind);
}
