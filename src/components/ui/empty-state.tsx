import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Kept for callers; an empty state is a sentence, not an illustration. */
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** Nothing here, said plainly inside a dashed rule. */
export function EmptyState({ title, description, action, className, size = "md" }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start border border-dashed border-rule-strong", size === "md" ? "px-6 py-10" : "px-4 py-6", className)}>
      <h3 className={cn("font-display text-ink", size === "md" ? "text-2xl" : "text-xl")}>{title}</h3>
      {description ? <p className="mt-2 max-w-[55ch] text-base text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
