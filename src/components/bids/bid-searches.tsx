"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import type { BidSearchFilters, SavedSearch } from "@/lib/types";
import type { SamNotice } from "@/lib/services/contracts";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const SET_ASIDE_CHOICES = ["Total small business", "8(a)", "HUBZone", "Service-disabled veteran-owned", "Women-owned small business", "Veteran-owned", "DBE", "MBE", "WBE"];

const words = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export type BidList = { status: "live" | "recorded" | "not_connected"; note: string; notices: SamNotice[]; recordedOn: string | null };

/**
 * Saved bid searches over the opportunity database: work categories (NAICS), states, set-asides, and words.
 * "Your profile" uses the firm's own NAICS codes and states. Choosing a search reruns it and replaces the list.
 */
export function BidSearches({ saved: initial, profile, onResults }: { saved: SavedSearch[]; profile: { naics: string[]; states: string[] }; onResults: (r: BidList, label: string) => void }) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial.filter((s) => s.filters));
  const [active, setActive] = React.useState<string>("profile");
  const [running, setRunning] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", naics: profile.naics.join(", "), states: profile.states.join(", "), setAsides: [] as string[], keywords: "" });

  const run = async (id: string, filters: BidSearchFilters | null, label: string) => {
    setRunning(id);
    try {
      const r = await services.bids.searchSam({ filters });
      setActive(id);
      onResults(r, label);
    } catch (err) {
      toast({ title: "The search did not run", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    } finally {
      setRunning(null);
    }
  };

  const save = async () => {
    const filters: BidSearchFilters = { naics: words(form.naics).map((x) => x.replace(/\D/g, "")).filter((x) => x.length >= 2), states: words(form.states).map((x) => x.toUpperCase()).filter((x) => /^[A-Z]{2}$/.test(x)), setAsides: form.setAsides, keywords: words(form.keywords) };
    const name = form.name.trim() || [filters.naics.join(", "), filters.states.join(", ")].filter(Boolean).join(" in ") || "Saved search";
    const s = await services.opportunities.saveSearch({ name, keyword: "", fundingCategories: [], filters });
    setSaved((l) => [s, ...l]);
    setOpen(false);
    toast({ title: "Search saved", description: "New matches also arrive in the weekly digest." });
    void run(s.id, filters, s.name);
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saved bid searches">
        <Button size="sm" variant={active === "profile" ? "primary" : "secondary"} loading={running === "profile"} aria-pressed={active === "profile"} onClick={() => run("profile", null, "Your profile")}>
          Your profile
        </Button>
        {saved.map((s) => (
          <span key={s.id} className="inline-flex items-center">
            <Button size="sm" variant={active === s.id ? "primary" : "secondary"} loading={running === s.id} aria-pressed={active === s.id} onClick={() => run(s.id, s.filters ?? null, s.name)}>
              {s.name}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete the saved search ${s.name}`}
              onClick={async () => {
                await services.opportunities.deleteSavedSearch(s.id);
                setSaved((l) => l.filter((x) => x.id !== s.id));
                if (active === s.id) void run("profile", null, "Your profile");
              }}
            >
              <Trash2 />
            </Button>
          </span>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Save a new search
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save a bid search</DialogTitle>
            <DialogDescription>Leave a field empty to mean any. Saved searches run against the whole database, and new bids they find also come in the weekly digest.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field id="bs-name" label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Public safety buildings in Texas" />
            </Field>
            <Field id="bs-naics" label="NAICS codes" hint="Six digits, or the first few digits for a whole group, like 2362. Separate with commas.">
              <Input value={form.naics} onChange={(e) => setForm({ ...form, naics: e.target.value })} className="font-mono" />
            </Field>
            <Field id="bs-states" label="States" hint="Two-letter codes, separated with commas.">
              <Input value={form.states} onChange={(e) => setForm({ ...form, states: e.target.value })} className="font-mono" />
            </Field>
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Set-asides</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SET_ASIDE_CHOICES.map((a) => (
                  <label key={a} className={cn("flex items-center gap-2 text-sm text-ink")}>
                    <Checkbox checked={form.setAsides.includes(a)} onCheckedChange={(v) => setForm({ ...form, setAsides: v ? [...form.setAsides, a] : form.setAsides.filter((x) => x !== a) })} />
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id="bs-words" label="Words in the title or description" hint="Any of these, separated with commas. For example: fire station, clinic renovation.">
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save and run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
