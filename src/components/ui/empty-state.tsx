import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Kept for older callers; empty states are words only. */
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  art?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** Nothing here yet, said plainly on a quiet tint. */
export function EmptyState({ title, description, action, className, size = "md" }: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg bg-paper-tint", size === "md" ? "px-6 py-8 sm:px-8" : "px-5 py-6", className)}>
      <h3 className={cn("font-display text-ink", size === "md" ? "text-2xl" : "text-xl")}>{title}</h3>
      {description ? <p className="mt-2 max-w-[55ch] text-base text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
