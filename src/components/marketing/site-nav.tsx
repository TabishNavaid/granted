import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-6 text-sm text-fg-muted md:flex">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#trust" className="hover:text-fg">Trust</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo size="sm" />
          <p className="mt-2 max-w-xs text-sm text-fg-muted">A done-for-you funding team for small nonprofits. Built with early users in Ohio, Texas, and Oregon.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-fg-muted sm:grid-cols-3">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <a href="#faq" className="hover:text-fg">Questions</a>
          <Link href="/design" className="hover:text-fg">Design system</Link>
          <Link href="/sign-in" className="hover:text-fg">Sign in</Link>
          <a href="mailto:hello@granted.example" className="hover:text-fg">Contact</a>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-fg-subtle sm:px-6">Granted is a working name. Nothing is submitted, sent, or posted without your approval.</p>
      </div>
    </footer>
  );
}
