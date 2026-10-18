"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Day" },
  { value: "dark", label: "Night" },
  { value: "system", label: "Device" },
] as const;

/** Day print, night print, or whatever the device says. Three words, no icons. */
export function ThemeToggle({ className }: { className?: string; tone?: "paper" | "night" }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? theme ?? "system" : "system";
  return (
    <div role="radiogroup" aria-label="Print" className={cn("inline-flex items-center gap-3 text-sm", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          onClick={() => setTheme(o.value)}
          className={cn("underline-offset-4 decoration-2 hover:text-ink", current === o.value ? "font-semibold text-ink underline" : "text-ink-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
