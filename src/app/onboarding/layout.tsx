import { DemoOnboardingShell } from "@/components/demo/demo-shell";
import { browserDemoFlag } from "@/lib/demo/server";
import { OnboardingFrame, loadOnboardingShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const flag = browserDemoFlag();
  if (flag) return <DemoOnboardingShell flag={flag} nonce={crypto.randomUUID()}>{children}</DemoOnboardingShell>;
  return <OnboardingFrame shell={await loadOnboardingShell()}>{children}</OnboardingFrame>;
}
