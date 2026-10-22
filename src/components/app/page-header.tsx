import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** A page title in the headline face, with one sentence under it. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-title text-ink">{title}</h1>
        {description ? <p className="mt-3 max-w-[60ch] text-lg text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageContainer({ children, className, width = "default" }: { children: React.ReactNode; className?: string; width?: "default" | "wide" | "narrow" | "full" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-12",
        width === "default" && "max-w-[64rem]",
        width === "wide" && "max-w-[84rem]",
        width === "narrow" && "max-w-[46rem]",
        width === "full" && "max-w-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
