import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { LanternGlyph } from "@/components/brand/illustrations";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <LanternGlyph size={80} lit={false} className="mt-10 text-fg-subtle" />
      <h1 className="mt-6 font-display text-3xl text-fg">Nothing lit down this way.</h1>
      <p className="mt-2 max-w-sm text-base text-fg-muted">The link may be old, or the item may have been removed. Your Inbox has everything that is current.</p>
      <Button asChild className="mt-6">
        <Link href="/inbox">Back to your Inbox</Link>
      </Button>
    </main>
  );
}
