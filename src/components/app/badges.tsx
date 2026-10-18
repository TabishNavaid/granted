import { Badge } from "@/components/ui/badge";
import { agentMeta, milestoneMeta, stageMeta } from "@/lib/agents/meta";
import type { AgentName, ApplicationStage, MilestoneKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Activity, CalendarDays, Compass, FileText, Mail, Sparkle, UserRound } from "lucide-react";

export function StageBadge({ stage, className }: { stage: ApplicationStage; className?: string }) {
  const m = stageMeta[stage];
  return (
    <Badge variant={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}

export function MilestoneBadge({ kind, className }: { kind: MilestoneKind; className?: string }) {
  const m = milestoneMeta[kind];
  return (
    <Badge variant={m.tone} className={className}>
      {m.label}
    </Badge>
  );
}

const agentIcons: Record<AgentName, typeof Compass> = {
  profile: UserRound,
  discovery: Compass,
  planner: Sparkle,
  proposal: FileText,
  outreach: Mail,
  calendar: CalendarDays,
};

export function AgentMark({ agent, size = "md", className }: { agent: AgentName; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = agentIcons[agent] ?? Activity;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-sunken text-fg-muted",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-4",
        size === "lg" && "size-11 [&_svg]:size-5",
        className,
      )}
      aria-hidden
    >
      <Icon />
    </span>
  );
}

export function AgentLabel({ agent, className }: { agent: AgentName; className?: string }) {
  return <span className={cn("text-xs font-medium text-fg-subtle", className)}>{agentMeta[agent].label}</span>;
}
