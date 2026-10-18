import { Logo } from "@/components/app/logo";
import { OnboardingSteps } from "./steps";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-sm text-fg-subtle">Setup</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <OnboardingSteps />
        <main id="main" className="mt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
