"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const allSteps = [
  { href: "/onboarding", label: "Website" },
  { href: "/onboarding/documents", label: "Documents", demoOnly: true },
  { href: "/onboarding/interview", label: "Short interview", demoOnly: true },
  { href: "/onboarding/profile", label: "Confirm profile" },
  { href: "/onboarding/matches", label: "First matches" },
];

/** Setup progress as a printed line: a number and a word per step, the current one underlined in ink. */
export function OnboardingSteps({ demo = true }: { demo?: boolean }) {
  const pathname = usePathname();
  const steps = demo ? allSteps : allSteps.filter((s) => !s.demoOnly);
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
              className={cn("flex items-baseline gap-2 text-base", active ? "-mb-[13px] border-b-2 border-ink pb-3 font-semibold text-ink" : "text-ink-muted")}
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
