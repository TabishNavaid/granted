import { DemoAppShell } from "@/components/demo/demo-shell";
import { browserDemoFlag } from "@/lib/demo/server";
import { AppFrame, loadShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const flag = browserDemoFlag();
  if (flag) return <DemoAppShell flag={flag} nonce={crypto.randomUUID()}>{children}</DemoAppShell>;
  return <AppFrame shell={await loadShell()}>{children}</AppFrame>;
}
