"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import { services, type WorkspaceSummary } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Consultant mode: one login, several organizations. Shows the open one and
 * switches between them. In the demo the list is the sample organizations.
 */
export function WorkspaceSwitcher({ orgName, workspaces, demo, className, onNavigate }: { orgName: string; workspaces: WorkspaceSummary[]; demo: boolean; className?: string; onNavigate?: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const go = async (id: string) => {
    setBusy(id);
    await services.org.switchWorkspace(id);
    const org = await services.org.get();
    setBusy(null);
    onNavigate?.();
    router.push(org.onboardingStep === "done" ? "/inbox" : "/onboarding");
    router.refresh();
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn("flex w-full min-h-10 items-center justify-between gap-2 rounded-md border border-rule px-3 py-2 text-left text-sm hover:border-rule-strong", className)} aria-label={`Organization: ${orgName}. Switch organization`}>
            <span className="min-w-0 truncate font-semibold text-ink">{orgName}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>{demo ? "Sample organizations" : "Your organizations"}</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} disabled={busy !== null} onSelect={() => (w.current ? undefined : void go(w.id))} className="flex items-start gap-2">
              <Check className={cn("mt-0.5 size-4 shrink-0", w.current ? "opacity-100" : "opacity-0")} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-ink">{w.name}</span>
                {w.kind ? <span className="block truncate text-xs text-ink-muted">{w.kind}</span> : null}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAdding(true)}>Add an organization</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Add an organization</DialogTitle>
            <DialogDescription>For consultants and fiscal sponsors: each organization gets its own profile, matches, drafts, and calendar. Switch between them from here.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setBusy("new");
              await services.org.createWorkspace(name);
              setBusy(null);
              setAdding(false);
              setName("");
              onNavigate?.();
              router.push("/onboarding");
              router.refresh();
            }}
          >
            <Field id="new-org" label="Organization name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Westside Community Garden" autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy === "new"} disabled={!name.trim()}>
                Add and set it up
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
