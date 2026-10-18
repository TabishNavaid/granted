import * as React from "react";
import { cn } from "@/lib/utils";

interface InkStampProps {
  /** What the stamp says: Approved, Sent, Submitted, Funded. */
  label: string;
  /** A second line, usually the date. */
  line?: string;
  /** Whether it thumps in. Static stamps are for things that were approved earlier. */
  animate?: boolean;
  /** Degrees. Real stamps never land straight. */
  rotate?: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * A rubber stamp in fluorescent pink ink. It multiplies over whatever is
 * under it (so it overprints a yellow highlight to red-orange), the edges are
 * roughened by the stamp-ink filter, and it lands slightly rotated.
 */
export function InkStamp({ label, line, animate = false, rotate = -8, size = "md", className }: InkStampProps) {
  return (
    <span
      role="img"
      aria-label={line ? `${label}, ${line}` : label}
      className={cn(
        "stamp",
        size === "sm" && "text-[0.95rem]",
        size === "md" && "text-[1.15rem]",
        size === "lg" && "text-[1.6rem]",
        size === "xl" && "text-[2.4rem]",
        animate && "animate-stamp",
        className,
      )}
      style={{ ["--stamp-rot" as string]: `${rotate}deg` }}
    >
      <span className="stamp-word">{label}</span>
      {line ? <span className="stamp-line">{line}</span> : null}
    </span>
  );
}

/** Formats a date the way a date stamp does: "Oct 18, 2026". */
export function stampDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
