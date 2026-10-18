import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * A tag: sentence case text inside a square rule. Used only where a status
 * is a fact (a stage, a milestone kind). Three inks carry every state:
 * blue for neutral and done, yellow for waiting on you, burgundy for wrong or late.
 */
const badgeVariants = cva("tag", {
  variants: {
    variant: {
      neutral: "",
      outline: "",
      info: "",
      accent: "tag-ink",
      success: "tag-ink",
      warning: "tag-yellow",
      danger: "tag-burgundy",
      pink: "tag-pink",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
