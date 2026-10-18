import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PublicImage } from "@/lib/images";

export type Inks = "blue-pink" | "blue-yellow";

interface DuotoneProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  inks?: Inks;
  priority?: boolean;
  sizes?: string;
  /** Crop to this aspect ratio (CSS value like "4 / 3"). Defaults to the image's own. */
  aspect?: string;
  /** Where the crop should sit. */
  position?: string;
  className?: string;
  caption?: React.ReactNode;
}

/**
 * A photograph printed in two riso inks: shadows in Federal Blue, highlights
 * in pink or yellow, midtones on the overprint, with a halftone dot overlay.
 * Any photo passed through here is on brand, including future photos from users.
 */
export function Duotone({ src, alt, width, height, inks = "blue-pink", priority, sizes = "100vw", aspect, position = "50% 50%", className, caption }: DuotoneProps) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className="relative isolate overflow-hidden border border-ink bg-paper-tint" style={{ aspectRatio: aspect ?? `${width} / ${height}` }}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
          style={{ objectPosition: position, filter: `url(#duo-${inks}) contrast(1.06)` }}
        />
        <div className="halftone pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      </div>
      {caption ? <figcaption className="mt-2 max-w-[60ch] text-xs leading-snug text-ink-muted">{caption}</figcaption> : null}
    </figure>
  );
}

/** The standard credit line for a Library of Congress image. */
export function ImageCredit({ image }: { image: PublicImage }) {
  return (
    <>
      {image.creator}, {image.date}.{" "}
      <a href={image.locUrl} target="_blank" rel="noreferrer" className="underline decoration-[1px] underline-offset-2 hover:decoration-pink">
        Library of Congress
      </a>
      , {image.collection}. Public domain.
    </>
  );
}

/** A catalog image, already cropped and credited. */
export function Plate({ image, inks, aspect, position, priority, sizes, className, credit = true }: { image: PublicImage; inks?: Inks; aspect?: string; position?: string; priority?: boolean; sizes?: string; className?: string; credit?: boolean }) {
  return (
    <Duotone
      src={image.file}
      alt={image.alt}
      width={image.width}
      height={image.height}
      inks={inks}
      aspect={aspect}
      position={position ?? image.position}
      priority={priority}
      sizes={sizes}
      className={className}
      caption={credit ? <ImageCredit image={image} /> : undefined}
    />
  );
}
