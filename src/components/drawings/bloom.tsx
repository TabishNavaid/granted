import * as React from "react";
import type { DrawingAsset } from "@/lib/drawings";
import { cn } from "@/lib/utils";
import { Drawing } from "./drawing";

interface BloomProps {
  flower: DrawingAsset;
  /** Grow it: leaves first, then the flowers open. Otherwise it is simply there. */
  grow?: boolean;
  /** Wait this long before growing, for a row of flowers coming up one after another. */
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A small watercolor flower that can open. The drawing is shown twice, split
 * where the flowers start: the leaves are revealed upward from the line they
 * stand on, then the flowers open from their middle once the leaves are up. With reduced motion both animations end instantly, so the flower is
 * just there. Size it with a height class; the width follows the drawing.
 */
export function Bloom({ flower, grow = false, delayMs = 0, className, style }: BloomProps) {
  const head = flower.head;
  const vars = {
    aspectRatio: `${flower.width} / ${flower.height}`,
    "--bloom-delay": `${delayMs}ms`,
    "--head": head ? `${head.bottom * 100}%` : "0%",
    ...style,
  } as React.CSSProperties;

  if (!head) {
    return (
      <span aria-hidden className={cn("relative inline-block", className)} style={vars}>
        <Drawing asset={flower} className={cn("absolute inset-0 h-full w-full", grow && "animate-rise")} />
      </span>
    );
  }

  return (
    <span aria-hidden className={cn("relative inline-block", className)} style={vars}>
      <Drawing asset={flower} className={cn("absolute inset-0 h-full w-full [clip-path:inset(var(--head)_0_0_0)]", grow && "animate-stem")} />
      <Drawing
        asset={flower}
        className={cn("absolute inset-0 h-full w-full [clip-path:inset(0_0_calc(100%-var(--head)-1%)_0)]", grow && "animate-head")}
        style={{ transformOrigin: `${head.x * 100}% ${head.y * 100}%` }}
      />
    </span>
  );
}
