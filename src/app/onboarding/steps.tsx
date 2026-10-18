"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { href: "/onboarding", label: "Website and EIN" },
  { href: "/onboarding/documents", label: "Documents" },
  { href: "/onboarding/interview", label: "Short interview" },
  { href: "/onboarding/profile", label: "Confirm profile" },
  { href: "/onboarding/matches", label: "First matches" },
];

export function OnboardingSteps() {
  const pathname = usePathname();
  const current = Math.max(0, steps.findIndex((s) => s.href === pathname));
  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.href} className={cn("flex min-w-0 items-center gap-2 sm:gap-3", i < steps.length - 1 ? "flex-1 basis-0" : "shrink-0")}>
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  done && "bg-accent text-accent-fg",
                  active && "bg-accent-soft text-accent-soft-fg ring-2 ring-accent",
                  !done && !active && "bg-surface-sunken text-fg-subtle",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("hidden truncate text-sm md:inline", active ? "font-medium text-fg" : "text-fg-subtle")} aria-current={active ? "step" : undefined}>
                {s.label}
              </span>
              <span className="sr-only">
                {s.label}, {done ? "complete" : active ? "current step" : "not started"}
              </span>
              {i < steps.length - 1 ? <span className={cn("h-px flex-1", done ? "bg-accent" : "bg-border")} aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-fg-muted md:hidden">
        Step {current + 1} of {steps.length}: {steps[current].label}
      </p>
    </nav>
  );
}
