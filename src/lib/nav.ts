import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, CalendarDays, Compass, Inbox, KanbanSquare, Landmark, Library, Mail, Megaphone, MessageSquareText, Settings, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const primaryNav: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/opportunities", label: "Opportunities", icon: Compass },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/outreach", label: "Outreach", icon: Mail },
  { href: "/profile", label: "Profile and knowledge", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
];

export const secondaryNav: NavItem[] = [
  { href: "/funders", label: "Funders", icon: Landmark },
  { href: "/connections", label: "Connections", icon: Users },
  { href: "/social", label: "Social", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ask", label: "Ask", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The sidebar for each kind of applicant. Firms see owners rather than
 * funders and no social calendar; individuals see a short list.
 */
export function navFor(orgType: import("@/lib/types").OrgType): { primary: NavItem[]; secondary: NavItem[] } {
  if (orgType === "firm") {
    return {
      primary: [
        { href: "/inbox", label: "Inbox", icon: Inbox },
        { href: "/opportunities", label: "Bids and opportunities", icon: Compass },
        { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
        { href: "/profile", label: "Firm and records", icon: Library },
        { href: "/outreach", label: "Outreach", icon: Mail },
        { href: "/activity", label: "Activity", icon: Activity },
      ],
      secondary: [
        { href: "/analytics", label: "Win analytics", icon: BarChart3 },
        { href: "/funders", label: "Owners and funders", icon: Landmark },
        { href: "/ask", label: "Ask", icon: MessageSquareText },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    };
  }
  if (orgType === "research") {
    return {
      primary: [
        { href: "/inbox", label: "Inbox", icon: Inbox },
        { href: "/opportunities", label: "Funding", icon: Compass },
        { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
        { href: "/profile", label: "Team and records", icon: Library },
        { href: "/activity", label: "Activity", icon: Activity },
      ],
      secondary: [
        { href: "/funders", label: "Funders", icon: Landmark },
        { href: "/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/ask", label: "Ask", icon: MessageSquareText },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    };
  }
  if (orgType === "individual") {
    return {
      primary: [
        { href: "/inbox", label: "Inbox", icon: Inbox },
        { href: "/opportunities", label: "Scholarships", icon: Compass },
        { href: "/pipeline", label: "Applications", icon: KanbanSquare },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
        { href: "/profile", label: "My profile", icon: Library },
      ],
      secondary: [
        { href: "/ask", label: "Ask", icon: MessageSquareText },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    };
  }
  return { primary: primaryNav, secondary: secondaryNav };
}
