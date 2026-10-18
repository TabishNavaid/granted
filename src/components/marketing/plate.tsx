import type { PlateAsset } from "@/lib/drawings";
import { cn } from "@/lib/utils";

/**
 * One of Mary Vaux Walcott's watercolors shown whole, as a painting: the
 * paper, her pencil notes, and a small museum caption with the plant, the
 * artist, the year, and where it is held.
 */
export function Plate({ plate, className, eager }: { plate: PlateAsset; className?: string; eager?: boolean }) {
  return (
    <figure className={cn("min-w-0", className)}>
      <picture>
        <source type="image/webp" srcSet={`${plate.file}.webp`} />
        <img
          src={`${plate.file}.jpg`}
          width={plate.width}
          height={plate.height}
          alt={plate.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="block h-auto w-full shadow-[0_1px_2px_rgb(28_35_64/0.08),0_18px_40px_-24px_rgb(28_35_64/0.35)]"
        />
      </picture>
      <figcaption className="mt-4 text-xs leading-relaxed text-ink-muted">
        <span className="block text-sm text-ink">
          {plate.plant} <i className="font-display italic">{plate.latin}</i>
        </span>
        <span className="block">
          {plate.credit.author}, {plate.year}. {plate.medium.charAt(0).toUpperCase() + plate.medium.slice(1)}.
        </span>
        <span className="block">{plate.collection.split(",")[0]}.</span>
      </figcaption>
    </figure>
  );
}
