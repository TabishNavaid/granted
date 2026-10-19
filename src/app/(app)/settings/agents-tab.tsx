"use client";

import * as React from "react";
import type { AgentAutonomy, AgentName } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const agentLabels: { agent: AgentName; label: string; does: string }[] = [
  { agent: "profile", label: "Reading and facts", does: "Reads your site and documents and proposes facts." },
  { agent: "discovery", label: "Finding grants", does: "Searches for funders and scores them against your profile." },
  { agent: "planner", label: "Monthly plan", does: "Proposes which applications to take on next month." },
  { agent: "proposal", label: "Drafting", does: "Writes letters and proposals from confirmed facts." },
  { agent: "outreach", label: "Funder emails", does: "Drafts introductions, questions, thank-yous, and follow-ups." },
  { agent: "calendar", label: "Deadlines and milestones", does: "Plans milestones backward from each deadline." },
];

const levels: { value: AgentAutonomy; label: string; means: string }[] = [
  { value: "draft", label: "Draft only", means: "Everything waits in the Inbox for you." },
  { value: "schedule", label: "Draft and schedule", means: "Milestones and reminders go straight on the calendar. Drafts still wait." },
  { value: "act", label: "Act with approval", means: "Prepares the next step so it takes one click from you." },
];

/** How far each agent may go on its own. */
export function AgentsTab({ initial, isOwner }: { initial: Record<AgentName, AgentAutonomy>; isOwner: boolean }) {
  const { toast } = useToast();
  const [autonomy, setAutonomy] = React.useState(initial);
  const [saving, setSaving] = React.useState<AgentName | null>(null);

  const change = async (agent: AgentName, level: AgentAutonomy) => {
    const before = autonomy;
    setAutonomy((a) => ({ ...a, [agent]: level }));
    setSaving(agent);
    try {
      setAutonomy(await services.org.setAutonomy(agent, level));
      const name = agentLabels.find((a) => a.agent === agent)?.label ?? agent;
      toast({ title: `${name}: ${levels.find((l) => l.value === level)?.label}` });
    } catch (err) {
      setAutonomy(before);
      toast({ title: "Not changed", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">How far each agent goes</h2>
      <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Each agent stops at its level and waits for you.</p>
            <dl className="mt-4 grid max-w-3xl gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {levels.map((l) => (
          <div key={l.value}>
            <dt className="font-semibold text-ink">{l.label}</dt>
            <dd className="text-ink-muted">{l.means}</dd>
          </div>
        ))}
      </dl>
      {!isOwner ? <p className="mt-4 text-sm text-ink-muted">Only the workspace owner can change these.</p> : null}
      <ul className="mt-6 border-t border-rule">
        {agentLabels.map((a) => (
          <li key={a.agent} className="border-b border-rule py-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h3 id={`auto-${a.agent}-label`} className="text-base font-semibold text-ink">
                  {a.label}
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">{a.does}</p>
              </div>
              <div role="radiogroup" aria-labelledby={`auto-${a.agent}-label`} className="flex flex-wrap gap-2">
                {levels.map((l) => {
                  const id = `auto-${a.agent}-${l.value}`;
                  const on = autonomy[a.agent] === l.value;
                  return (
                    <div key={l.value}>
                      <input type="radio" id={id} name={`auto-${a.agent}`} value={l.value} checked={on} disabled={saving === a.agent} onChange={() => change(a.agent, l.value)} className="peer sr-only" />
                      <label
                        htmlFor={id}
                        className={cn(
                          "inline-flex h-9 cursor-pointer items-center rounded-md border-[1.5px] px-3 text-sm transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                          on ? "border-ink bg-paper-tint font-semibold text-ink" : "border-rule-strong text-ink-muted hover:border-ink hover:text-ink",
                        )}
                      >
                        {l.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-[65ch] text-base font-semibold text-ink">Nothing is ever sent, posted, or submitted without your click, at any level.</p>
    </div>
  );
}
