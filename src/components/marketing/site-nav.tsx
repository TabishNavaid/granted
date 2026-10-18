import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Trust" },
  { href: "#pricing", label: "Pricing" },
  { href: "#questions", label: "Questions" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper">
      <div className="mx-auto flex h-16 max-w-[75rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-7 text-base text-ink md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="underline-offset-4 decoration-2 hover:underline hover:decoration-pink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-5">
          <Link href="/sign-in" className="text-base text-ink underline-offset-4 decoration-2 hover:underline hover:decoration-pink">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/sign-up">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink">
      <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <Logo size="sm" />
          <p className="mt-4 max-w-[40ch] text-base text-ink-muted">{PRODUCT_TAGLINE} Built with early users in Ohio, Texas, New Mexico, and North Carolina.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-3 text-base text-ink sm:grid-cols-3">
          <a href="#how" className="underline-offset-4 hover:underline">How it works</a>
          <a href="#pricing" className="underline-offset-4 hover:underline">Pricing</a>
          <a href="#questions" className="underline-offset-4 hover:underline">Questions</a>
          <Link href="/design" className="underline-offset-4 hover:underline">Design system</Link>
          <Link href="/art-review" className="underline-offset-4 hover:underline">Image credits</Link>
          <Link href="/sign-in" className="underline-offset-4 hover:underline">Sign in</Link>
        </nav>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-[75rem] px-4 py-5 text-sm text-ink-muted sm:px-6 lg:px-10">
          {PRODUCT_NAME} is a working name. The stories on this page are illustrative.
        </p>
      </div>
    </footer>
  );
}
