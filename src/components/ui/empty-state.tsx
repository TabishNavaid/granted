import * as React from "react";
import { cn } from "@/lib/utils";
import { LanternGlyph } from "@/components/brand/illustrations";

interface EmptyStateProps {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

/** Empty states show an unlit lantern by default: nothing is waiting, and that is fine. */
export function EmptyState({ icon, illustration, title, description, action, className, size = "md" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "wash-paper flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong text-center",
        size === "md" ? "px-6 py-14" : "px-4 py-8",
        className,
      )}
    >
      {illustration ?? (icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-glow-soft text-glow-fg [&_svg]:size-5" aria-hidden>
          {icon}
        </div>
      ) : (
        <LanternGlyph size={size === "md" ? 64 : 44} lit={false} className="mb-4 text-fg-subtle" />
      ))}
      <h3 className={cn("font-display text-fg", size === "md" ? "text-xl" : "text-lg")}>{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
