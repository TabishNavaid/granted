"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/** A rule with the done part filled in ink. Square ends. */
const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { tone?: "accent" | "success" | "warning" | "danger" }
>(({ className, value = 0, tone = "accent", ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} value={value} className={cn("relative h-[3px] w-full overflow-hidden bg-rule", className)} {...props}>
    <ProgressPrimitive.Indicator
      className={cn("h-full transition-transform duration-300", tone === "warning" ? "bg-yellow" : tone === "danger" ? "bg-burgundy" : "bg-ink")}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = "Progress";

export { Progress };
