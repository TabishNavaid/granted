"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

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
    className={cn(
      "flex max-w-full items-center gap-1 overflow-x-auto",
      variant === "line" && "border-b border-border",
      variant === "pill" && "w-fit rounded-md bg-surface-sunken p-1",
      className,
    )}
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
      "group/tab relative inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-50",
      // line variant
      "[[data-variant=line]_&]:-mb-px [[data-variant=line]_&]:border-b-2 [[data-variant=line]_&]:border-transparent [[data-variant=line]_&]:px-3 [[data-variant=line]_&]:py-2.5 [[data-variant=line]_&]:data-[state=active]:border-accent [[data-variant=line]_&]:data-[state=active]:text-fg",
      // pill variant
      "[[data-variant=pill]_&]:rounded-sm [[data-variant=pill]_&]:px-3 [[data-variant=pill]_&]:py-1.5 [[data-variant=pill]_&]:data-[state=active]:bg-surface-raised [[data-variant=pill]_&]:data-[state=active]:text-fg [[data-variant=pill]_&]:data-[state=active]:shadow-xs",
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
  <TabsPrimitive.Content ref={ref} className={cn("mt-4 outline-none focus-visible:outline-2", className)} {...props} />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
