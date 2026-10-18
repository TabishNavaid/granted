"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Tabs are a row of plain words. The current one is bold with an ink line
 * under it. "line" sits on a page rule; "pill" is the same thing without the
 * rule, for filters that live inside a section.
 */
const Tabs = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Root>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Root ref={ref} className={cn("min-w-0 max-w-full", className)} {...props} />,
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: "line" | "pill" }
>(({ className, variant = "line", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex max-w-full items-end gap-5 overflow-x-auto", variant === "line" && "border-b border-rule", className)}
    data-variant={variant}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group/tab relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent pb-2 text-base text-ink-muted transition-colors hover:text-ink disabled:opacity-50 data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-6 outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
