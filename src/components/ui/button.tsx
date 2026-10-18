import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Buttons are calm: the text face, one ink, softly rounded. Primary is the
 * deep crayon blue. Buttons say exactly what happens and never carry an arrow.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-body font-bold transition-colors duration-100 select-none disabled:opacity-50 disabled:pointer-events-none active:translate-y-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-[1.5px] border-primary bg-primary text-primary-fg hover:border-primary-hover hover:bg-primary-hover",
        secondary: "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-tint",
        soft: "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-tint",
        ghost: "rounded-none text-ink underline-offset-4 decoration-[1.5px] hover:underline",
        danger: "border-[1.5px] border-alert bg-alert text-white hover:opacity-90",
        "danger-ghost": "rounded-none text-alert underline-offset-4 decoration-[1.5px] hover:underline",
        link: "h-auto px-0 font-body font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-corn",
      },
      size: {
        sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
        md: "h-10 px-4 text-base [&_svg]:size-4",
        lg: "h-12 px-6 text-lg [&_svg]:size-5",
        icon: "size-10 [&_svg]:size-4",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
