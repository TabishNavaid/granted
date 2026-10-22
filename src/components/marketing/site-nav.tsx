"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

const links = [
  { href: "/product", label: "Product" },
  { href: "/who-its-for", label: "Who it's for" },
  { href: "/data", label: "The data" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/free", label: "Free" },
];

/** The audience pages, listed under "Who it's for" in the nav and the footer. */
const audienceLinks = [
  { href: "/for/architecture-and-construction", label: "Architecture, engineering, and construction" },
  { href: "/for/nonprofits", label: "Nonprofits" },
  { href: "/for/research", label: "Research teams" },
  { href: "/for/students", label: "Students" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * "Who it's for" on a wide screen: the link to the overview page, and a
 * button beside it that opens the four audience pages. Escape or a click
 * outside closes it.
 */
function AudienceMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const here = isActive(pathname, "/who-its-for") || audienceLinks.some((l) => isActive(pathname, l.href));
  return (
    <div ref={ref} className="relative flex items-center gap-0.5">
      <Link href="/who-its-for" className={cn("underline-offset-4 decoration-2 hover:underline hover:decoration-ink", here && "font-semibold")}>
        Who it&apos;s for
      </Link>
      <button
        ref={button}
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-sm text-ink hover:bg-paper-tint"
        aria-expanded={open}
        aria-controls="audience-menu"
        aria-label="Pages for each audience"
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id="audience-menu" className="absolute left-0 top-full z-40 mt-3 w-72 rounded-md border border-rule bg-paper p-2 shadow-lift">
          <ul className="flex flex-col">
            {audienceLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} aria-current={pathname === l.href ? "page" : undefined} className={cn("block rounded-sm px-3 py-2 underline-offset-4 hover:bg-paper-tint hover:underline", pathname === l.href && "font-semibold")}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-rule pt-1">
              <Link href="/who-its-for" onClick={() => setOpen(false)} className="block rounded-sm px-3 py-2 text-ink-muted underline-offset-4 hover:bg-paper-tint hover:text-ink hover:underline">
                All of them, with what is limited today
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper">
      <div className="mx-auto flex h-16 max-w-[75rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Logo />
        <nav aria-label="Site" className="hidden items-center gap-6 text-base text-ink lg:flex">
          {links.map((l) =>
            l.href === "/who-its-for" ? (
              <AudienceMenu key={l.href} pathname={pathname} />
            ) : (
              <Link key={l.href} href={l.href} className={cn("underline-offset-4 decoration-2 hover:underline hover:decoration-ink", isActive(pathname, l.href) && "font-semibold")}>
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/sign-in" className="text-base text-ink underline-offset-4 decoration-2 hover:underline hover:decoration-ink">
            Sign in
          </Link>
          <Button asChild>
            <Link href="/sign-up">Create a free workspace</Link>
          </Button>
        </div>
        <button type="button" className="inline-flex size-10 items-center justify-center text-ink lg:hidden" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>
      {open ? (
        <nav id="site-menu" aria-label="Site" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-rule px-4 py-4 sm:px-6 lg:hidden">
          <ul className="flex flex-col gap-1 text-base text-ink">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={close} className="block py-2 underline-offset-4 hover:underline">
                  {l.label}
                </Link>
                {l.href === "/who-its-for" ? (
                  <ul className="mb-1 flex flex-col border-l border-rule pl-4">
                    {audienceLinks.map((x) => (
                      <li key={x.href}>
                        <Link href={x.href} onClick={close} className="block py-2 text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                          {x.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
            <li>
              <Link href="/sign-in" onClick={close} className="block py-2 underline-offset-4 hover:underline">
                Sign in
              </Link>
            </li>
            <li className="pt-2">
              <Button asChild className="w-full">
                <Link href="/sign-up" onClick={close}>
                  Create a free workspace
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "Overview" },
      { href: "/product/matching", label: "Matching" },
      { href: "/product/drafting", label: "Drafting with sources" },
      { href: "/product/deadlines", label: "Deadlines and calendar" },
      { href: "/product/outreach", label: "Outreach" },
      { href: "/product/connections", label: "Connections" },
      { href: "/product/analytics", label: "Win analytics" },
    ],
  },
  { title: "Who it's for", links: [{ href: "/who-its-for", label: "Overview" }, ...audienceLinks] },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/free", label: "Free while we learn" },
      { href: "/data", label: "Where the data comes from" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/onboarding", label: "Try the demo" },
    ],
  },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/faq", label: "Questions" }, { href: "/security", label: "Security" }, { href: "/contact", label: "Contact" }] },
  { title: "Legal", links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-10">
        <div>
          <Logo size="sm" />
          <p className="mt-4 max-w-[26ch] text-base text-ink-muted">{PRODUCT_TAGLINE}</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-8 text-base text-ink sm:grid-cols-3 sm:gap-x-10 xl:grid-cols-5">
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
          {PRODUCT_NAME} drafts. You decide. Nothing is sent or submitted without you. Every opportunity links to its official source.
        </p>
      </div>
    </footer>
  );
}
