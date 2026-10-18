import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Drawing } from "@/components/drawings/drawing";
import { Button } from "@/components/ui/button";
import { drawingOf } from "@/lib/drawings";

export default function NotFound() {
  const sprout = drawingOf("seedling");
  return (
    <main className="flex min-h-screen max-w-3xl flex-col items-start justify-center px-4 sm:px-12">
      <Logo size="md" />
      {sprout ? <Drawing asset={sprout} className="mt-12 h-24 w-auto sm:h-28" /> : null}
      <h1 className="mt-6 font-display text-h1 text-ink">Nothing has grown at this address.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">The link may be old, or the item was removed. Your Inbox has everything that is current.</p>
      <Button asChild className="mt-8">
        <Link href="/inbox">Back to your Inbox</Link>
      </Button>
    </main>
  );
}
