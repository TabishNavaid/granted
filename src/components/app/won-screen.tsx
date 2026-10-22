"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

interface WonScreenProps {
  orgName: string;
  funderName: string;
  amount: number | null;
  onDismiss: () => void;
}

/**
 * The one screen that celebrates: an application was won. A full page, the news set large like an entry in a
 * ledger, and what happens next. It is a real dialog, so focus stays inside and Escape closes it.
 */
export function WonScreen({ orgName, funderName, amount, onDismiss }: WonScreenProps) {
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onDismiss()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink animate-fade-in focus:outline-none" aria-describedby="won-desc">
          <div className="mx-auto flex min-h-full w-full max-w-[75rem] flex-col justify-center px-4 py-20 sm:px-10">
            <LogoMark className="h-10 w-10 text-fellow" />
            <p className="mt-8 text-lg text-ink-muted sm:text-xl">{funderName} said yes.</p>
            <DialogPrimitive.Title className="mt-2 font-display text-display text-ink">Won.</DialogPrimitive.Title>
            <dl className="mt-10 grid max-w-2xl gap-x-10 gap-y-4 border-y border-ink py-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-muted">Awarded to</dt>
                <dd className="mt-1 text-xl font-semibold text-ink">{orgName}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Amount</dt>
                <dd className="mt-1 font-mono text-xl text-ink tnum">{amount ? formatMoney(amount) : "As stated in the award letter"}</dd>
              </div>
            </dl>
            <DialogPrimitive.Description id="won-desc" className="mt-6 max-w-[52ch] text-lg text-ink-muted">
              Somebody read what you wrote and said yes. A thank-you email draft is waiting in Outreach and the Inbox, and a report reminder about a year out is on the calendar. Check it against the date in your award letter.
            </DialogPrimitive.Description>
            <div className="mt-9">
              <DialogPrimitive.Close asChild>
                <Button size="lg">Back to the pipeline</Button>
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
