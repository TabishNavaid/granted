import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { services } from "@/lib/services";
import { OnboardingSteps } from "./steps";
import { ORG_TYPES } from "@/lib/segments";

export type OnboardingShell = { demo: { active: boolean; replay: boolean }; steps: { href: string; label: string }[] };

/** The step list and the demo note. On a server it loads for the page; in the browser demo it loads in the tab. */
export async function loadOnboardingShell(): Promise<OnboardingShell> {
  const [demo, org] = await Promise.all([services.demo.status(), services.org.get()]);
  const steps = org.onboardingStep === "start" ? [{ href: "/onboarding", label: "Who you are" }, ...ORG_TYPES[org.orgType ?? "nonprofit"].steps.slice(1)] : ORG_TYPES[org.orgType ?? "nonprofit"].steps;
  return { demo: { active: demo.active, replay: demo.replay }, steps };
}

export function OnboardingFrame({ shell, children }: { shell: OnboardingShell | null; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-base text-ink-muted">Setup</span>
        </div>
      </header>
      {shell?.demo.active ? (
        <div className="border-b border-rule bg-paper-tint">
          <p className="mx-auto max-w-4xl px-4 py-2.5 text-sm text-ink sm:px-6">
            <span className="mr-2 inline-flex items-center rounded-sm border border-rule-strong px-1.5 text-xs font-semibold text-ink-muted">Demo data</span>
            {shell.demo.replay ? "Setup runs on fictional samples (nonprofits, a design firm, a research lab, a student) and replays a recorded run through the live code. The Grants.gov and SAM.gov notices, the solicitation, and the foundation filings are real." : "Setup runs live against a fictional sample organization."}{" "}
            <Link href="/inbox" className="font-semibold underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              Skip to the sample workspace
            </Link>
          </p>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        {shell ? <OnboardingSteps steps={shell.steps} /> : <div />}
        <main id="main" className="mt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
