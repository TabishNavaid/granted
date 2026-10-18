import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen max-w-3xl flex-col items-start justify-center px-6 sm:px-12">
      <Logo size="md" />
      <h1 className="mt-10 font-display text-h1 text-ink">There is nothing at this address.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">The link may be old, or the page moved. Your Inbox has everything that is current, and the front page explains the rest.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/inbox">Go to your Inbox</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Front page</Link>
        </Button>
      </div>
    </main>
  );
}
