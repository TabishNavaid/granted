"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? theme ?? "system" : "system";
  return (
    <div role="radiogroup" aria-label="Color theme" className={cn("inline-flex rounded-md bg-surface-sunken p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setTheme(o.value)}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-[5px] text-fg-subtle transition-colors hover:text-fg",
            current === o.value && "bg-surface-raised text-fg shadow-xs",
          )}
        >
          <o.icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
