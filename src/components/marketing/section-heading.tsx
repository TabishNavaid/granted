import { Drawing } from "@/components/drawings/drawing";
import { drawing } from "@/lib/drawings";

/**
 * A marketing section heading, with at most one small watercolor plant. The
 * plant stands on the baseline of the heading's last line, joined to the last
 * word so it can never wrap onto a line of its own. Use a plant on one
 * heading per page at most, the same way the landing does.
 */
export function SectionHeading({ plant, className, as: Tag = "h2", children }: { plant?: string; className?: string; as?: "h1" | "h2"; children: string }) {
  const cut = children.lastIndexOf(" ");
  const head = children.slice(0, cut + 1);
  const last = children.slice(cut + 1);
  return (
    <Tag className={`font-display text-ink ${className ?? "text-4xl sm:text-5xl"}`}>
      {head}
      <span className="whitespace-nowrap">
        {last}
        {plant ? (
          <span aria-hidden className="relative ml-[0.2em] inline-block h-0 w-[0.8em] align-baseline">
            <Drawing asset={drawing(plant)} className="absolute bottom-[-0.04em] left-0 h-[1em] w-auto" />
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
