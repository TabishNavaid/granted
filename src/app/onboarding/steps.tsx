"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  { href: "/onboarding", label: "Website" },
  { href: "/onboarding/ein", label: "EIN" },
  { href: "/onboarding/reading", label: "Reading" },
  { href: "/onboarding/profile", label: "Confirm" },
  { href: "/onboarding/gaps", label: "A few questions" },
  { href: "/onboarding/matches", label: "First matches" },
];

/** Setup progress as a line of steps: a number and a word each, the current one underlined in ink. */
export function OnboardingSteps() {
  const pathname = usePathname();
  const current = Math.max(0, steps.findIndex((s) => s.href === pathname));
  return (
    <nav aria-label="Setup progress">
      <ol className="hidden items-baseline gap-6 border-b border-rule pb-3 md:flex">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={s.href}
              aria-current={active ? "step" : undefined}
              className={cn("flex items-baseline gap-2 text-base", active ? "-mb-[14px] border-b-2 border-ink pb-3 font-semibold text-ink" : "text-ink-muted")}
            >
              <span className="font-display text-lg tnum" aria-hidden>
                {i + 1}
              </span>
              <span aria-hidden>{s.label}</span>
              <span className="sr-only">
                {s.label}, {done ? "complete" : active ? "current step" : "not started"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="border-b border-rule pb-3 text-base text-ink md:hidden">
        Step {current + 1} of {steps.length}: <span className="font-semibold">{steps[current].label}</span>
      </p>
    </nav>
  );
}
