"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services, type SampleInfo } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export interface DemoInfo {
  replay: boolean;
  recordedOn: string;
  current: SampleInfo | null;
  orgName: string;
}

/**
 * A small, always-visible label that this is the demo, with a plain account
 * of what is real and what is replayed. Never hidden, never loud.
 */
export function DemoTag({ demo }: { demo: DemoInfo }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex min-h-6 shrink-0 items-center rounded-sm border border-rule-strong px-2 text-xs font-semibold text-ink-muted hover:border-ink hover:text-ink" aria-label="Demo data. What is real here?">
          Demo data
        </button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>You are looking at the demo</DialogTitle>
          <DialogDescription>Nothing here is sent anywhere, and your changes stay in this browser session.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-base text-ink">
          <p>{demo.orgName} is a fictional organization, and its website does not exist.{demo.current?.history ? " Its six months of history, funders included, are sample data." : ""}</p>
          {demo.replay ? (
            <p>
              The agents replay a run recorded on {formatDate(demo.recordedOn)}: the pages read, the facts found, the searches, the scores, and the letter. They replay through the same code the live product uses, so every check still runs. No AI model is called.
            </p>
          ) : (
            <p>A model key is set on this server, so the agents run live against this sample workspace.</p>
          )}
          <p>The Grants.gov notices are real, and the private foundations come from their real IRS Form 990-PF filings.</p>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/onboarding?restart=1" onClick={() => setOpen(false)}>
              Run setup with a sample
            </Link>
          </Button>
          <Button
            variant="ghost"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await services.demo.reset();
              setBusy(false);
              setOpen(false);
              router.push("/inbox");
              router.refresh();
            }}
          >
            Start this sample over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
