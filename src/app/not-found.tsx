import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen max-w-3xl flex-col items-start justify-center px-6 sm:px-12">
      <Logo size="md" />
      <h1 className="mt-10 font-display text-h1 text-ink">Nothing printed at this address.</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">The link may be old, or the item was removed. Your Inbox has everything that is current.</p>
      <Button asChild className="mt-8">
        <Link href="/inbox">Back to your Inbox</Link>
      </Button>
    </main>
  );
}
