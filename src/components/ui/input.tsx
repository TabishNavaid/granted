import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClasses =
  "flex h-10 w-full rounded-md border border-border-input bg-surface-raised px-3 py-2 text-base text-fg shadow-xs transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-danger md:text-sm";

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
