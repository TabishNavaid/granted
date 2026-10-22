import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[75rem] flex-col justify-center px-4 py-16 sm:px-6 lg:px-10">
      <Logo size="md" />
      <p className="mt-14 font-mono text-sm text-ink-muted">404</p>
      <h1 className="mt-2 max-w-[18ch] font-display text-h1 text-ink">There is nothing at this address.</h1>
      <p className="mt-4 max-w-[58ch] text-lg text-ink-muted">The link may be old, or the page moved. If you were looking for an opportunity, it may have closed; the database keeps only what is open or recently closed.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Go to the front page</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/inbox">Open your Inbox</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/data">See what the database covers</Link>
        </Button>
      </div>
    </main>
  );
}
