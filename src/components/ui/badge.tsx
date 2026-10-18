import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A tag: sentence case text inside a thin rule. Used only where a status is
 * a fact (a stage, a milestone kind). Ink for neutral and done, a crayon
 * circle for waiting on you, poppy red for wrong or late, grass for won.
 */
const badgeVariants = cva("tag", {
  variants: {
    variant: {
      neutral: "",
      outline: "",
      info: "",
      accent: "tag-ink",
      success: "tag-ink",
      warning: "circled border-transparent font-semibold",
      danger: "tag-alert",
      bloom: "tag-bloom",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
