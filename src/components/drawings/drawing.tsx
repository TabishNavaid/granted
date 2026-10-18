import * as React from "react";
import type { DrawingAsset } from "@/lib/drawings";
import { cn } from "@/lib/utils";

interface DrawingProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "alt"> {
  asset: DrawingAsset;
  /** Empty by default: almost every drawing is decoration next to words that already say it. */
  alt?: string;
  /** Load right away instead of when it scrolls near. For drawings in the first screen. */
  eager?: boolean;
}

/**
 * One watercolor, cut out of its paper by scripts/clean-drawing.
 * The files are already 2x and optimized, so they go straight to the browser:
 * WebP where it is supported, PNG otherwise.
 */
export function Drawing({ asset, alt = "", eager, className, ...props }: DrawingProps) {
  return (
    <picture className="contents">
      <source type="image/webp" srcSet={`${asset.file}.webp`} />
      <img
        src={`${asset.file}.png`}
        width={asset.width}
        height={asset.height}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className={cn("pointer-events-none max-w-none select-none", className)}
        {...props}
      />
    </picture>
  );
}
