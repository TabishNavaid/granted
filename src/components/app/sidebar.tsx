"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { LanternMark, Logo } from "./logo";
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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
        active ? "bg-night-raised text-night-fg" : "text-night-muted hover:bg-night-hover hover:text-night-fg",
      )}
    >
      {active ? <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-glow" /> : null}
      <item.icon className={cn("size-4 shrink-0", active ? "text-glow" : "text-night-muted group-hover:text-night-fg")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon ? <span className="rounded-full border border-night-border px-1.5 py-px text-2xs font-semibold text-night-muted">Soon</span> : null}
      {badge ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-glow px-1.5 py-px text-2xs font-bold text-glow-fg tnum" aria-label={`${badge} waiting for you`}>
          <LanternMark className="size-3" />
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
    <div className="flex h-full flex-col bg-night text-night-fg">
      <div className="px-5 pb-5 pt-5">
        <Logo href="/inbox" tone="paper" />
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} badge={item.href === "/inbox" ? pendingCount : undefined} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-7 px-3 text-2xs font-bold uppercase tracking-wider text-night-muted/80">Later</p>
        <ul className="flex flex-col gap-0.5">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-night-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <Avatar name={userName} size="sm" className="bg-glow text-glow-fg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-night-fg">{userName}</p>
            <p className="truncate text-xs text-night-muted">{orgName}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between px-2">
          <ThemeToggle tone="night" />
          <Link href="/" className="text-xs text-night-muted hover:text-night-fg">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block" aria-label="Sidebar">
      <NavBody {...props} />
    </aside>
  );
}

export function MobileTopBar(props: SidebarProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-night px-4 text-night-fg lg:hidden">
      <Logo href="/inbox" size="sm" tone="paper" />
      <div className="flex items-center gap-2">
        {props.pendingCount ? (
          <Link href="/inbox" className="inline-flex items-center gap-1 rounded-full bg-glow px-2 py-0.5 text-xs font-bold text-glow-fg tnum" aria-label={`${props.pendingCount} waiting in your Inbox`}>
            <LanternMark className="size-3" /> {props.pendingCount}
          </Link>
        ) : null}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="text-night-fg hover:bg-night-hover hover:text-night-fg">
              <Menu />
            </Button>
          </DialogTrigger>
          <DialogContent size="sheet" className="border-night-border bg-night p-0">
            <DialogTitle className="sr-only">Menu</DialogTitle>
            <NavBody {...props} onNavigate={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
