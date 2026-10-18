import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-sm font-medium text-fg-subtle">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl leading-tight text-fg sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageContainer({ children, className, width = "default" }: { children: React.ReactNode; className?: string; width?: "default" | "wide" | "narrow" | "full" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-7xl",
        width === "narrow" && "max-w-3xl",
        width === "full" && "max-w-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
