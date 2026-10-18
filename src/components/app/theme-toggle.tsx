"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Dawn", icon: Sun },
  { value: "system", label: "Match my device", icon: Monitor },
  { value: "dark", label: "Night", icon: Moon },
] as const;

export function ThemeToggle({ className, tone = "paper" }: { className?: string; tone?: "paper" | "night" }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? theme ?? "system" : "system";
  const night = tone === "night";
  return (
    <div role="radiogroup" aria-label="Color theme" className={cn("inline-flex rounded-full p-0.5", night ? "bg-night-raised" : "bg-surface-sunken", className)}>
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
            "inline-flex size-7 items-center justify-center rounded-full transition-colors",
            night ? "text-night-muted hover:text-night-fg" : "text-fg-subtle hover:text-fg",
            current === o.value && (night ? "bg-glow text-glow-fg hover:text-glow-fg" : "bg-surface-raised text-fg shadow-xs"),
          )}
        >
          <o.icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
