import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Buttons are printed, not molded: square corners, poster type, one ink.
 * Primary is the deepest ink on the page (yellow in night print). Buttons
 * say exactly what happens and never carry an arrow.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-bold transition-colors duration-100 select-none disabled:opacity-50 disabled:pointer-events-none active:translate-y-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-[1.5px] border-primary bg-primary text-primary-fg hover:border-ink hover:bg-ink dark:hover:border-white dark:hover:bg-white",
        secondary: "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-tint",
        soft: "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-tint",
        ghost: "text-ink underline-offset-4 decoration-[1.5px] hover:underline",
        danger: "border-[1.5px] border-burgundy bg-burgundy text-white hover:opacity-90 dark:text-paper",
        "danger-ghost": "text-burgundy underline-offset-4 decoration-[1.5px] hover:underline",
        link: "h-auto px-0 font-body font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink",
      },
      size: {
        sm: "h-9 px-3 text-sm [&_svg]:size-4",
        md: "h-10 px-4 text-sm [&_svg]:size-4",
        lg: "h-12 px-6 text-base [&_svg]:size-5",
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
