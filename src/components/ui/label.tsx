"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-base font-semibold leading-snug text-ink peer-disabled:opacity-60", className)} {...props} />
));
Label.displayName = "Label";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Wraps a control with a label, optional hint, and error message, wiring aria attributes. */
function Field({ id, label, hint, error, optional, children, className }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const control = React.cloneElement(child, {
    id,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional ? <span className="text-sm text-ink-muted">Optional</span> : null}
      </div>
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-semibold text-burgundy">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Label, Field };
