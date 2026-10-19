import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { services } from "@/lib/services";
import { OnboardingSteps } from "./steps";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const demo = await services.demo.status();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-base text-ink-muted">Setup</span>
        </div>
      </header>
      {demo.active ? (
        <div className="border-b border-rule bg-paper-tint">
          <p className="mx-auto max-w-4xl px-4 py-2.5 text-sm text-ink sm:px-6">
            <span className="mr-2 inline-flex items-center rounded-sm border border-rule-strong px-1.5 text-xs font-semibold text-ink-muted">Demo data</span>
            {demo.replay ? "Setup runs on fictional sample organizations and replays a recorded run through the live code. Grants.gov notices and foundation filings are real." : "Setup runs live against a fictional sample organization."}{" "}
            <Link href="/inbox" className="font-semibold underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              Skip to the sample workspace
            </Link>
          </p>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <OnboardingSteps />
        <main id="main" className="mt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
