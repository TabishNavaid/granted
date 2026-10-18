import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";

export function SiteNav({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const paper = tone === "paper";
  return (
    <header className={paper ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur"}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo tone={tone} />
        <nav aria-label="Site" className={`hidden items-center gap-7 text-sm font-semibold md:flex ${paper ? "text-night-fg/85" : "text-fg-muted"}`}>
          <a href="#how" className="hover:underline underline-offset-4">How it works</a>
          <a href="#trust" className="hover:underline underline-offset-4">Trust</a>
          <a href="#stories" className="hover:underline underline-offset-4">Stories</a>
          <a href="#pricing" className="hover:underline underline-offset-4">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className={paper ? "text-night-fg hover:bg-night-fg/10 hover:text-night-fg" : ""}>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant={paper ? "glow" : "primary"} size="sm">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo size="sm" />
          <p className="mt-3 max-w-xs text-sm text-fg-muted">A funding team that walks beside small nonprofits. Built with early users in Ohio, Texas, New Mexico, and North Carolina.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm text-fg-muted sm:grid-cols-3">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <a href="#faq" className="hover:text-fg">Questions</a>
          <Link href="/design" className="hover:text-fg">Design system</Link>
          <Link href="/sign-in" className="hover:text-fg">Sign in</Link>
          <a href="mailto:hello@example.org" className="hover:text-fg">Say hello</a>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-fg-subtle sm:px-6">
          {PRODUCT_NAME} is a working name. Stories on this page are illustrative. Nothing is submitted, sent, or posted without your approval.
        </p>
      </div>
    </footer>
  );
}
