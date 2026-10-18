import * as React from "react";
import { grassStrips, jitter, type DrawingAsset } from "@/lib/drawings";
import { cn } from "@/lib/utils";
import { Bloom } from "./bloom";
import { Drawing } from "./drawing";

export interface MeadowFlower {
  key: string;
  flower: DrawingAsset;
  /** Grow it now, stem first. Flowers that were already there are simply drawn. */
  grow?: boolean;
  delayMs?: number;
}

interface MeadowProps {
  flowers: MeadowFlower[];
  /** Changes where the grass and flowers fall, so two meadows never match. */
  seed?: string;
  /** How tall the meadow is. Flowers are 55 to 100 percent of it. */
  className?: string;
  /** Grow the grass up too (the won celebration). */
  growGrass?: boolean;
  /** How many clumps of grass across. More for wider meadows. */
  clumps?: number;
  /** Just a strip of grass, no flowers: one dense row, used in place of a rule. */
  strip?: boolean;
  /** On a phone, show only this many flowers so the meadow does not turn into a wall. */
  mobileMax?: number;
}

/** Positions that never move as flowers are added: each new one lands in the biggest gap. */
function slot(i: number, seed: string) {
  const golden = 0.6180339887;
  const base = (0.37 + i * golden) % 1;
  return 4 + base * 90 + (jitter(seed, i) - 0.5) * 3;
}

/**
 * A strip of crayon meadow: a back row of grass, the flowers, and a front row
 * of grass that hides where the stems go in. Decorative only; whatever it
 * stands for is said in words next to it.
 */
export function Meadow({ flowers, seed = "meadow", className, growGrass = false, clumps = 32, strip = false, mobileMax }: MeadowProps) {
  const back = grassStrips[0];
  const front = grassStrips[1] ?? grassStrips[0];
  const backAt = (i: number) => grassStrips[i % grassStrips.length];
  return (
    <div aria-hidden className={cn("pointer-events-none relative h-28 w-full overflow-hidden select-none", className)}>
      {back
        ? Array.from({ length: clumps }).map((_, i) => (
            <GrassClump key={`b${i}`} asset={backAt(i)} left={(i / clumps) * 104 - 6 + jitter(seed + "b", i) * 4} heightPct={strip ? 55 + jitter(seed + "bh", i) * 45 : 28 + jitter(seed + "bh", i) * 30} flip={i % 2 === 1} grow={growGrass} delayMs={i * 25} />
          ))
        : null}
      {flowers.map((f, i) => {
        const h = 58 + jitter(seed + "fh", i) * 42;
        return (
          <span key={f.key} className={cn("absolute bottom-0", mobileMax !== undefined && i >= mobileMax && "max-sm:hidden")} style={{ left: `${slot(i, seed)}%`, height: `${h}%`, transform: "translateX(-50%)" }}>
            <Bloom flower={f.flower} grow={f.grow} delayMs={f.delayMs} className="h-full" />
          </span>
        );
      })}
      {front && !strip
        ? Array.from({ length: Math.round(clumps * 0.8) }).map((_, i, all) => (
            <GrassClump key={`f${i}`} asset={front} left={(i / all.length) * 104 - 4 + jitter(seed + "f", i) * 5} heightPct={14 + jitter(seed + "fh2", i) * 16} flip={i % 2 === 0} grow={growGrass} delayMs={120 + i * 25} />
          ))
        : null}
    </div>
  );
}

function GrassClump({ asset, left, heightPct, flip, grow, delayMs }: { asset: DrawingAsset; left: number; heightPct: number; flip: boolean; grow: boolean; delayMs: number }) {
  return (
    <span className="absolute bottom-0" style={{ left: `${left}%`, height: `${heightPct}%`, aspectRatio: `${asset.width} / ${asset.height}`, transform: flip ? "scaleX(-1)" : undefined }}>
      <Drawing asset={asset} className={cn("h-full w-full", grow && "animate-rise")} style={{ ["--bloom-delay" as string]: `${delayMs}ms` }} />
    </span>
  );
}
