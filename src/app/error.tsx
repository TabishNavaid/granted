"use client";

import { Wordmark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen max-w-3xl flex-col items-start justify-center px-6 sm:px-12">
      <Wordmark size="md" />
      <h1 className="mt-10 font-display text-h1 text-ink">Something went wrong on our side.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">Nothing you did caused this and nothing was lost. Try again, and if it keeps happening, write to us.</p>
      {error.digest ? <p className="mt-3 text-sm text-ink-muted">Reference {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
