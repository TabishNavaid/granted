import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { services } from "@/lib/services";
import { OnboardingSteps } from "./steps";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const runtime = await services.loop.runtime();
  const demo = runtime.demo && !runtime.ai;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-base text-ink-muted">Setup</span>
        </div>
      </header>
      {demo ? (
        <div className="border-b border-rule bg-paper-tint">
          <p className="mx-auto max-w-4xl px-4 py-2.5 text-sm text-ink sm:px-6">
            This is a demo. Setup walks through a sample organization, Riverbend Youth Collective, because no model key is set on this server.{" "}
            <Link href="/settings/integrations" className="font-semibold underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              See what to connect
            </Link>
            .
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
