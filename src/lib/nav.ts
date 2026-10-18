import type { LucideIcon } from "lucide-react";
import { Activity, CalendarDays, Compass, Inbox, KanbanSquare, Library, Megaphone, Settings, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

export const primaryNav: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profile", label: "Profile and knowledge", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
];

export const secondaryNav: NavItem[] = [
  { href: "/connections", label: "Connections", icon: Users, comingSoon: true },
  { href: "/social", label: "Social", icon: Megaphone, comingSoon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];
