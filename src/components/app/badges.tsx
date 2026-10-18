import { Badge } from "@/components/ui/badge";
import { milestoneMeta, stageMeta } from "@/lib/agents/meta";
import type { ApplicationStage, MilestoneKind } from "@/lib/types";

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
