import { Logo } from "@/components/app/logo";
import { services } from "@/lib/services";
import { OnboardingSteps } from "./steps";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const runtime = await services.loop.runtime();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-base text-ink-muted">Setup</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <OnboardingSteps demo={runtime.demo && !runtime.ai} />
        <main id="main" className="mt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
