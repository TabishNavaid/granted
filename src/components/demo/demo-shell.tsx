"use client";

import * as React from "react";
import { setBrowserDemo, type BrowserDemo } from "@/lib/demo/flags";
import { AppFrame, loadShell } from "@/app/(app)/shell";
import { OnboardingFrame, loadOnboardingShell } from "@/app/onboarding/shell";
import type { SidebarProps } from "@/components/app/sidebar";
import type { OnboardingShell } from "@/app/onboarding/shell";

/** Load a layout's data in the browser demo; again whenever the server renders the layout anew (`router.refresh()`). */
function useShell<T>(load: () => Promise<T>, nonce: string): T | null {
  const [data, setData] = React.useState<T | null>(null);
  React.useEffect(() => {
    let live = true;
    load().then(
      (d) => live && setData(d),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [load, nonce]);
  return data;
}

/** The app's frame in the browser demo: the page renders at once, the sidebar as soon as the saved state is read. */
export function DemoAppShell({ flag, nonce, children }: { flag: BrowserDemo; nonce: string; children: React.ReactNode }) {
  setBrowserDemo(flag);
  const shell = useShell<SidebarProps>(loadShell, nonce);
  return <AppFrame shell={shell}>{children}</AppFrame>;
}

export function DemoOnboardingShell({ flag, nonce, children }: { flag: BrowserDemo; nonce: string; children: React.ReactNode }) {
  setBrowserDemo(flag);
  const shell = useShell<OnboardingShell>(loadOnboardingShell, nonce);
  return <OnboardingFrame shell={shell}>{children}</OnboardingFrame>;
}
