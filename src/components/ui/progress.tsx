"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/** A thin line with the done part filled in ink. */
const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { tone?: "accent" | "success" | "warning" | "danger" }
>(({ className, value = 0, tone = "accent", ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} value={value} className={cn("relative h-1 w-full overflow-hidden rounded-round bg-rule", className)} {...props}>
    <ProgressPrimitive.Indicator
      className={cn("h-full rounded-round transition-transform duration-300", tone === "warning" ? "bg-ink-muted" : tone === "danger" ? "bg-alert" : "bg-ink")}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";

export { Progress };
