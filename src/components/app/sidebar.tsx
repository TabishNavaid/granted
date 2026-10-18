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

function NavLink({ item, active, badge, onNavigate }: { item: NavItem; active: boolean; badge?: number; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-accent-soft text-accent-soft-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
      )}
    >
      <item.icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon ? (
        <span className="rounded-full border border-border px-1.5 py-px text-2xs font-medium text-fg-subtle">Soon</span>
      ) : null}
      {badge ? (
        <span className="rounded-full bg-accent px-1.5 py-px text-2xs font-semibold text-accent-fg tnum" aria-label={`${badge} waiting`}>
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
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Logo href="/inbox" />
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} badge={item.href === "/inbox" ? pendingCount : undefined} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-6 px-3 text-2xs font-semibold uppercase tracking-wider text-fg-subtle">More</p>
        <ul className="flex flex-col gap-0.5">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <Avatar name={userName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{userName}</p>
            <p className="truncate text-xs text-fg-subtle">{orgName}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-2">
          <ThemeToggle />
          <Link href="/" className="text-xs text-fg-subtle hover:text-fg">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-surface lg:block" aria-label="Sidebar">
      <NavBody {...props} />
    </aside>
  );
}

export function MobileTopBar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur lg:hidden">
      <Logo href="/inbox" size="sm" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </DialogTrigger>
        <DialogContent size="sheet" className="p-0">
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <NavBody {...props} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
