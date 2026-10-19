"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { setBrowserDemo, type BrowserDemo } from "@/lib/demo/flags";

export function OpenSample({ flag, sample, next }: { flag: BrowserDemo; sample: string; next: string }) {
  setBrowserDemo(flag);
  const router = useRouter();
  React.useEffect(() => {
    // An unknown sample just goes on to the page, as the server route does.
    services.org
      .switchWorkspace(sample)
      .catch(() => undefined)
      .then(() => router.replace(next));
  }, [sample, next, router]);
  return (
    <main id="main" className="px-4 py-12 sm:px-6">
      <p role="status" className="text-base text-ink-muted">
        Opening the sample workspace
      </p>
    </main>
  );
}
