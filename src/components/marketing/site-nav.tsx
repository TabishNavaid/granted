"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-[75rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-7 text-base text-ink md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("underline-offset-4 decoration-2 hover:underline hover:decoration-ink", pathname === l.href && "font-semibold")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/sign-in" className="text-base text-ink underline-offset-4 decoration-2 hover:underline hover:decoration-ink">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/sign-up">Find my first grants</Link>
          </Button>
        </div>
        <button type="button" className="inline-flex size-10 items-center justify-center text-ink md:hidden" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open ? (
        <nav id="site-menu" aria-label="Site" className="border-t border-rule px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-1 text-base text-ink">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={close} className="block py-2 underline-offset-4 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/sign-in" onClick={close} className="block py-2 underline-offset-4 hover:underline">
                Sign in
              </Link>
            </li>
            <li className="pt-2">
              <Button asChild className="w-full">
                <Link href="/sign-up">Find my first grants</Link>
              </Button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

const footerGroups = [
  { title: "Product", links: [{ href: "/#how", label: "How it works" }, { href: "/pricing", label: "Pricing" }, { href: "/security", label: "Security" }, { href: "/#questions", label: "Questions" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <Logo size="sm" />
          <p className="mt-4 max-w-[40ch] text-base text-ink-muted">{PRODUCT_TAGLINE}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-6 text-base text-ink sm:grid-cols-3">
          {footerGroups.map((g) => (
            <div key={g.title}>
              <p className="font-semibold text-ink">{g.title}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-[75rem] px-4 py-5 text-sm text-ink-muted sm:px-6 lg:px-10">
          {PRODUCT_NAME} drafts. You decide. Nothing is sent or submitted without you.
        </p>
      </div>
    </footer>
  );
}
