import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

export function EmptyState({ icon, title, description, action, className, size = "md" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface text-center",
        size === "md" ? "px-6 py-14" : "px-4 py-8",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg [&_svg]:size-5" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className={cn("font-display text-fg", size === "md" ? "text-xl" : "text-lg")}>{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
