"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl text-fg">Something went wrong on our side.</h1>
      <p className="mt-2 max-w-sm text-base text-fg-muted">Nothing you did caused this, and nothing was lost. Try again, and if it keeps happening, email us.</p>
      {error.digest ? <p className="mt-2 text-xs text-fg-subtle">Reference {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
