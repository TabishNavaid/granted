"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Runs the Grants.gov search against the confirmed profile and refreshes the list. */
export function FindMatchesButton({ label = "Search Grants.gov now", size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size={size}
        variant="secondary"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          const r = await services.loop.findMatches();
          setLoading(false);
          if (!r.ok) {
            toast({ title: "We could not finish the search", description: r.error, tone: "warning" });
            return;
          }
          toast({ title: r.data.matchCount ? `${r.data.matchCount} match${r.data.matchCount === 1 ? "" : "es"} found` : "Nothing strong enough yet", description: `We screened ${r.data.screened} notices and read ${r.data.read} in full.` });
          router.refresh();
        }}
      >
        {loading ? "Searching Grants.gov" : label}
      </Button>
      {loading ? <span className="text-sm text-ink-muted" aria-live="polite">About a minute.</span> : null}
    </div>
  );
}
