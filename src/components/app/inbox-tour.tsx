"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";

const KEY = "inbox_tour_seen";

const stops = [
  { title: "This is your Inbox.", body: `Everything ${PRODUCT_NAME} does lands here first: funders it found, drafts it wrote, questions it needs answered, schedules it proposed. Nothing goes anywhere until you approve it.` },
  { title: "Approve, edit, or decline.", body: "Each item has a button that says exactly what it does. Approve files it. Decline asks for a short reason so the next one fits better. Undo is always there for a few seconds." },
  { title: "The plan for the month.", body: "On the first of the month a short plan appears at the top: two to five applications with the hours and the likely award. Keep, skip, or swap, then approve the plan." },
  { title: "Everything else is one click away.", body: "Opportunities holds every match. Pipeline tracks each application. Calendar keeps the deadlines. Profile holds your facts and their sources. Activity shows every step we took." },
];

/** A short, skippable walk through the Inbox on the first visit. Remembered in this browser. */
export function InboxTour() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    // Opened after paint so the page renders first and the dialog does not flash during hydration.
    const t = setTimeout(() => {
      let seen = false;
      try {
        seen = localStorage.getItem(KEY) === "1";
      } catch {
        seen = false;
      }
      if (params.get("tour") === "1" || !seen) setOpen(true);
    }, 400);
    return () => clearTimeout(t);
  }, [params]);
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // private window; the tour shows again next time, which is fine
    }
    setOpen(false);
    if (params.get("tour")) router.replace("/inbox");
  };
  const stop = stops[i];
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{stop.title}</DialogTitle>
          <DialogDescription>{stop.body}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-ink-muted tnum">
          {i + 1} of {stops.length}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Skip the tour
          </Button>
          {i < stops.length - 1 ? <Button onClick={() => setI((n) => n + 1)}>Next</Button> : <Button onClick={close}>Start using it</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
