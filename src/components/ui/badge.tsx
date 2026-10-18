import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap leading-4 [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-transparent bg-surface-sunken text-fg-muted",
        outline: "border-border-strong bg-transparent text-fg-muted",
        accent: "border-transparent bg-accent-soft text-accent-soft-fg",
        success: "border-transparent bg-success-soft text-success-soft-fg",
        warning: "border-transparent bg-warning-soft text-warning-soft-fg",
        danger: "border-transparent bg-danger-soft text-danger-soft-fg",
        info: "border-transparent bg-info-soft text-info-soft-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
