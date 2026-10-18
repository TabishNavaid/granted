"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  orgName: string;
  userName: string;
  pendingCount: number;
}

/** A nav item is a word. The current page is bold with a short ink bar beside it. */
function NavLink({ item, active, badge, onNavigate }: { item: NavItem; active: boolean; badge?: number; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex items-center gap-3 py-2 pl-5 pr-2 text-base text-ink transition-colors hover:text-ink-deep", active ? "font-semibold" : "text-ink-muted")}
    >
      {active ? <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-ink" /> : null}
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon ? <span className="text-xs text-ink-muted">Soon</span> : null}
      {badge ? (
        <mark className="highlight text-sm font-semibold tnum" aria-label={`${badge} waiting for you`}>
          {badge}
        </mark>
      ) : null}
    </Link>
  );
}

function NavBody({ orgName, userName, pendingCount, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/") || (href === "/pipeline" && pathname.startsWith("/applications"));
  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <div className="px-5 pb-6 pt-5">
        <Logo href="/inbox" size="sm" />
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} badge={item.href === "/inbox" ? pendingCount : undefined} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <ul className="mt-6 flex flex-col border-t border-rule pt-4">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-rule p-5">
        <div className="flex items-center gap-3">
          <Avatar name={userName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{userName}</p>
            <p className="truncate text-xs text-ink-muted">{orgName}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <ThemeToggle />
          <Link href="/" className="w-fit text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r-2 border-ink lg:block" aria-label="Sidebar">
      <NavBody {...props} />
    </aside>
  );
}

export function MobileTopBar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-ink bg-paper px-4 text-ink lg:hidden">
      <Logo href="/inbox" size="sm" />
      <div className="flex items-center gap-3">
        {props.pendingCount ? (
          <Link href="/inbox" className="text-sm font-semibold tnum" aria-label={`${props.pendingCount} waiting in your Inbox`}>
            <mark className="highlight">{props.pendingCount} waiting</mark>
          </Link>
        ) : null}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu />
            </Button>
          </DialogTrigger>
          <DialogContent size="sheet">
            <DialogTitle className="sr-only">Menu</DialogTitle>
            <NavBody {...props} onNavigate={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
