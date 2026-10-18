import * as React from "react";
import { cn } from "@/lib/utils";

/** A field: white, softly rounded, with a border that still reads at 3:1. */
export const inputClasses =
  "flex h-11 w-full rounded-md border-[1.5px] border-rule-strong bg-paper px-3 py-2 text-base text-ink transition-colors hover:border-ink placeholder:text-ink-muted focus-visible:outline-3 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-alert";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input type={type} className={cn(inputClasses, className)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(inputClasses, "h-auto min-h-24 py-2.5 leading-relaxed", className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Input, Textarea };
