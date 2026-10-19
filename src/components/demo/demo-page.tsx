"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEMO_PAGES, type DemoParams, type DemoRoute } from "@/lib/demo/pages";
import { setBrowserDemo, type BrowserDemo } from "@/lib/demo/flags";
import { Button } from "@/components/ui/button";

/**
 * A page of the browser demo. Runs the page's body here, against the
 * visitor's saved state, and shows what it returns. A redirect or a "not
 * found" from the body behaves as it would on a server; any other error goes
 * to the nearest error boundary.
 */
export function DemoPage({ route, params, searchParams, flag, nonce }: { route: DemoRoute; params: DemoParams; searchParams: DemoParams; flag: BrowserDemo; nonce: string }) {
  setBrowserDemo(flag);
  const router = useRouter();
  const [node, setNode] = React.useState<React.ReactNode>(null);
  const [failure, setFailure] = React.useState<{ error: unknown } | null>(null);
  const key = `${route}|${JSON.stringify(params)}|${JSON.stringify(searchParams)}`;

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const mod = await DEMO_PAGES[route]();
        const out = await mod.default({ params: Promise.resolve(params) as Promise<never>, searchParams: Promise.resolve(searchParams) as Promise<never> });
        if (live) setNode(out);
      } catch (error) {
        if (!live) return;
        const digest = typeof (error as { digest?: unknown })?.digest === "string" ? (error as { digest: string }).digest : "";
        if (digest.startsWith("NEXT_REDIRECT;")) {
          const parts = digest.split(";");
          const to = parts.slice(2, -2).join(";");
          if (parts[1] === "push") router.push(to);
          else router.replace(to);
          return;
        }
        if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return setNode(<DemoNotFound />);
        setFailure({ error });
      }
    })();
    return () => {
      live = false;
    };
    // params and searchParams are in the key; the nonce changes on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  if (failure) throw failure.error;
  // Until the first render lands. Later renders keep the last page on screen, as a server render would.
  return node ?? <DemoLoading />;
}

export function DemoLoading() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10" aria-busy="true">
      <p role="status" className="text-base text-ink-muted">
        Opening your workspace
      </p>
    </div>
  );
}

function DemoNotFound() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-10">
      <h1 className="font-display text-h1 text-ink">There is nothing at this address.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">It may be from another visit to the demo, or it was removed. Your Inbox has everything that is current.</p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/inbox">Go to your Inbox</Link>
        </Button>
      </div>
    </div>
  );
}
