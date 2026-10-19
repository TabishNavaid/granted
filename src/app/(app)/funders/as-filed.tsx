import type { Funder } from "@/lib/types";
import { cn } from "@/lib/utils";

type FiledApplication = { contact: string | null; howTo: string | null; deadlines: string | null; restrictions: string | null } | null;

export const funderTypeLabel: Record<Funder["type"], string> = {
  private_foundation: "Private foundation",
  community_foundation: "Community foundation",
  corporate: "Corporate giving",
  federal: "Federal",
  state: "State",
  family_fund: "Family fund",
  local_government: "Local government",
  university: "University",
  private_owner: "Private owner",
};

/** "Columbus, OH" from a directory foundation's description, which is written from its filing. */
export function placeOf(funder: Funder): string | null {
  const m = funder.description.match(/in ([^.,]+), ([A-Z]{2})\./);
  return m ? `${m[1]}, ${m[2]}` : null;
}

export function acceptsLabel(accepts: boolean | null) {
  if (accepts === true) return "Accepts applications";
  if (accepts === false) return "Gives only to organizations it chooses";
  return "Its filing does not say whether it accepts applications";
}

/** How to apply, deadlines, restrictions, and contact, word for word from the filing. */
export function AsFiled({ application, className }: { application: FiledApplication; className?: string }) {
  const rows = application
    ? ([
        ["How to apply, as filed", application.howTo],
        ["Deadlines, as filed", application.deadlines],
        ["Restrictions, as filed", application.restrictions],
        ["Contact, as filed", application.contact],
      ] as const).filter(([, v]) => v && v.trim())
    : [];
  if (!rows.length) return <p className={cn("text-base text-ink-muted", className)}>The filing gives no application instructions.</p>;
  return (
    <dl className={cn("border-t border-rule", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-base text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
