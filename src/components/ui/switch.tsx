"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** A toggle is round because a toggle is round. It is the one rounded control. */
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-round border-[1.5px] border-ink bg-paper transition-colors data-[state=checked]:bg-ink disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-round bg-ink transition-[transform,background-color] data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-paper data-[state=unchecked]:translate-x-[3px]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };
