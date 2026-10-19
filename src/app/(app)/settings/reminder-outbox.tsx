"use client";

import * as React from "react";
import Link from "next/link";
import type { ReminderPreview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const statusLabel: Record<ReminderPreview["status"], string> = { scheduled: "Scheduled", due: "Goes out today", sent: "Sent" };

/** Reminder emails before each milestone: what goes out, when, and to whom. */
export function ReminderOutbox({ reminders, canSend, enabled = true, className }: { reminders: ReminderPreview[]; canSend: boolean; enabled?: boolean; className?: string }) {
  return (
    <div className={className}>
      {!canSend ? (
        <p className="max-w-[65ch] text-sm text-ink-muted">
          Reminders are scheduled here and will send once email is set up on the{" "}
          <Link href="/settings/integrations" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
            Integrations page
          </Link>
          . Until then, this is what would go out.
        </p>
      ) : null}
      {reminders.length === 0 ? (
        <p className="mt-3 text-base text-ink-muted">{enabled ? "No reminders to send. They appear here once a milestone is coming up." : "Milestone reminders are turned off."}</p>
      ) : (
        <ul className="mt-3 border-t border-rule">
          {reminders.map((r) => (
            <li key={r.milestoneId} className="border-b border-rule py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 text-base font-semibold text-ink">{r.subject}</p>
                <p className={cn("shrink-0 text-sm", r.status === "due" ? "font-semibold text-ink" : "text-ink-muted")}>
                  {r.status === "sent" ? "Sent" : r.status === "due" ? statusLabel.due : `Goes out ${formatDate(r.sendOn, "EEE, MMM d")}`}
                </p>
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">To {r.to || "you"}</p>
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer font-semibold text-ink underline decoration-[1px] underline-offset-2">Read the email</summary>
                <p className="mt-2 max-w-[65ch] whitespace-pre-line border-l-2 border-rule pl-3 text-ink">{r.body}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
