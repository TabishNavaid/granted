import * as React from "react";
import { drawingOf } from "@/lib/drawings";
import { cn } from "@/lib/utils";
import { Drawing } from "@/components/drawings/drawing";

interface EmptyStateProps {
  /** Kept for older callers; the drawing is chosen with `art`. */
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  /** A small crayon drawing beside the words: bare grass means "nothing has bloomed yet", the sun means "you are caught up". */
  art?: "grass" | "sun" | "none";
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** Nothing here yet, said plainly next to a small drawing. */
export function EmptyState({ art = "grass", title, description, action, className, size = "md" }: EmptyStateProps) {
  const asset = art === "none" ? undefined : drawingOf(art);
  return (
    <div className={cn("flex flex-col items-start gap-5 sm:flex-row sm:items-end", size === "md" ? "py-8" : "py-5", className)}>
      {asset ? <Drawing asset={asset} className={cn("w-auto shrink-0", art === "sun" ? (size === "md" ? "h-28" : "h-20") : size === "md" ? "h-20" : "h-14")} /> : null}
      <div className="min-w-0 pb-1">
        <h3 className={cn("font-display text-ink", size === "md" ? "text-2xl" : "text-xl")}>{title}</h3>
        {description ? <p className="mt-2 max-w-[55ch] text-base text-ink-muted">{description}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
