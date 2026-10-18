import Image from "next/image";
import type { Painting as PaintingRecord } from "@/lib/art";
import { cn } from "@/lib/utils";

interface PaintingProps {
  painting: PaintingRecord;
  /** Where the crop should sit. Defaults to the catalog's focus. */
  focus?: string;
  /** Strength of the night grade and contrast overlay. */
  grade?: "deep" | "soft";
  priority?: boolean;
  className?: string;
  sizes?: string;
  /** Where the contrast scrim goes: top and bottom bands, or the left side behind left-aligned text. */
  shade?: "vertical" | "left";
}

/**
 * A public domain painting as a full-bleed backdrop, graded toward the brand:
 * a night multiply layer, a soft marigold wash, and gradients for text contrast.
 * The image file is never edited; the grade lives here, once.
 */
export function Painting({ painting, focus, grade = "deep", priority, className, sizes = "100vw", shade = "vertical" }: PaintingProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} aria-hidden>
      <Image src={painting.file} alt="" fill priority={priority} sizes={sizes} className="object-cover" style={{ objectPosition: focus ?? painting.focus }} />
      <div className={cn("absolute inset-0 bg-[#221e45] mix-blend-multiply", grade === "deep" ? "opacity-30" : "opacity-15")} />
      <div className="absolute inset-0 bg-[#f2ab3a] opacity-15 mix-blend-soft-light" />
      {shade === "left" ? (
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(27,24,56,0.88)_0%,rgba(27,24,56,0.7)_35%,rgba(27,24,56,0.15)_70%,rgba(27,24,56,0.05)_100%)]" />
      ) : (
        <div className={cn("absolute inset-0 bg-[linear-gradient(180deg,rgba(27,24,56,0.82)_0%,rgba(27,24,56,0.35)_32%,rgba(27,24,56,0.05)_55%,rgba(27,24,56,0.55)_85%,rgba(27,24,56,0.9)_100%)]", grade === "soft" && "bg-[linear-gradient(180deg,rgba(27,24,56,0.7)_0%,rgba(27,24,56,0.2)_35%,rgba(27,24,56,0.1)_65%,rgba(27,24,56,0.75)_100%)]")} />
      )}
    </div>
  );
}

/** A one-line credit for a painting, for the corner of a section. */
export function PaintingCredit({ painting, className }: { painting: PaintingRecord; className?: string }) {
  return (
    <p className={cn("text-2xs text-night-fg/60", className)}>
      <a href={painting.source} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
        {painting.artist.split(",")[0].split(" (")[0]}, <i>{painting.title}</i>, {painting.date}. {painting.museum}, public domain.
      </a>
    </p>
  );
}
