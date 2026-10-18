import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A tag: sentence case text inside a thin rule. Used only where a status is
 * a fact (a stage, a milestone kind). A thin rule for neutral, solid ink for
 * waiting on you, red for wrong or late.
 */
const badgeVariants = cva("tag", {
  variants: {
    variant: {
      neutral: "",
      outline: "",
      info: "",
      accent: "tag-ink",
      success: "tag-ink",
      warning: "tag-strong",
      danger: "tag-alert",
      won: "tag-ink font-semibold",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
