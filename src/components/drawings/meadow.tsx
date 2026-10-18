import * as React from "react";
import { jitter, meadowPlants } from "@/lib/drawings";
import { cn } from "@/lib/utils";
import { Drawing } from "./drawing";

interface MeadowProps {
  /** How many plants stand along the strip. */
  count?: number;
  /** Changes which plants and how tall, so two strips never match. */
  seed?: string;
  /** Set the strip's height here; plants are 70 to 100 percent of it. */
  className?: string;
  /** Let the plants grow up one after another (the landing hero and the Funded screen). */
  grow?: boolean;
  /** On a phone, show only this many plants, spread evenly across the strip. */
  mobileMax?: number;
  /** Use the variants painted for the dark ink band. */
  onDark?: boolean;
}

/**
 * A soft strip of watercolor wildflowers standing along a bottom edge.
 * Decoration only: it frames a section and never carries meaning.
 */
export function Meadow({ count = 11, seed = "meadow", className, grow = false, mobileMax, onDark = false }: MeadowProps) {
  const plants = meadowPlants(count, seed, onDark);
  const onPhone = new Set(mobileMax === undefined ? plants.map((_, i) => i) : Array.from({ length: mobileMax }, (_, k) => Math.round((k * (count - 1)) / Math.max(1, mobileMax - 1))));
  return (
    <div aria-hidden className={cn("pointer-events-none relative h-48 w-full select-none overflow-hidden", className)}>
      {plants.map((p, i) => {
        const left = count === 1 ? 50 : 2 + (i / (count - 1)) * 96 + (jitter(seed, i) - 0.5) * 3;
        const h = 72 + jitter(seed + "h", i) * 28;
        const flip = jitter(seed + "f", i) > 0.55;
        return (
          <span
            key={`${p.slug}-${i}`}
            className={cn("absolute bottom-0", !onPhone.has(i) && "max-sm:hidden")}
            style={{ left: `${left}%`, height: `${h}%`, aspectRatio: `${p.width} / ${p.height}`, transform: `translateX(-50%)${flip ? " scaleX(-1)" : ""}`, zIndex: i % 2 ? 1 : 2 }}
          >
            <Drawing asset={p} className={cn("h-full w-full", grow && "animate-rise")} style={{ ["--bloom-delay" as string]: `${200 + ((i * 5) % count) * 140}ms` }} />
          </span>
        );
      })}
    </div>
  );
}
