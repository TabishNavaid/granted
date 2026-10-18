"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  orgName: string;
  userName: string;
  pendingCount: number;
}

/** A nav item is a word. The current page is bold on a pale tint. */
function NavLink({ item, active, badge, onNavigate }: { item: NavItem; active: boolean; badge?: number; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex items-center gap-3 rounded-md py-2 pl-3 pr-3 text-base transition-colors hover:bg-paper-tint hover:text-ink", active ? "bg-paper-tint font-semibold text-ink" : "text-ink-muted")}
    >
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon ? <span className="text-xs text-ink-muted">Soon</span> : null}
      {badge ? (
        <span className="count" aria-label={`${badge} waiting for you`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavBody({ orgName, userName, pendingCount, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/") || (href === "/pipeline" && pathname.startsWith("/applications"));
  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <div className="px-6 pb-6 pt-6">
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
          <Link href="/" className="inline-flex min-h-6 w-fit items-center text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-rule lg:block" aria-label="Sidebar">
      <NavBody {...props} />
    </aside>
  );
}

export function MobileTopBar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rule bg-paper px-4 text-ink lg:hidden">
      <Logo href="/inbox" size="sm" />
      <div className="flex items-center gap-3">
        {props.pendingCount ? (
          <Link href="/inbox" className="inline-flex min-h-6 items-center text-sm font-semibold tnum" aria-label={`${props.pendingCount} waiting in your Inbox`}>
            <span className="count px-2">{props.pendingCount} waiting</span>
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
