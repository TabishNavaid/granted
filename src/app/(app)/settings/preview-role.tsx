"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/types";
import { services } from "@/lib/services";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const roles: { value: Member["role"]; label: string; can: string }[] = [
  { value: "owner", label: "Owner", can: "Everything, including the team, billing, and agent settings." },
  { value: "editor", label: "Editor", can: "Drafts and the knowledge base. Not the team or billing." },
  { value: "reviewer", label: "Board reviewer", can: "Reads, comments, and approves sections. No edits." },
];

/** Demo only: switch the signed-in user's role to see the workspace the way a teammate would. */
export function PreviewRole({ role, onChanged }: { role: Member["role"]; onChanged: (m: Member) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(role);
  const [pending, startTransition] = React.useTransition();

  const change = async (next: Member["role"]) => {
    const before = value;
    setValue(next);
    try {
      const m = await services.org.previewRole(next);
      onChanged(m);
      startTransition(() => router.refresh());
      toast({ title: `Seeing it as ${roles.find((r) => r.value === next)?.label.toLowerCase()}`, description: "Switch back here at any time." });
    } catch (err) {
      setValue(before);
      toast({ title: "Could not switch", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
    }
  };

  return (
    <section aria-labelledby="preview-as-title" className="mt-12 max-w-2xl border-t border-rule pt-6">
      <h2 id="preview-as-title" className="font-display text-xl text-ink">
        Preview as
      </h2>
      <p className="mt-1 text-sm text-ink-muted">In the demo you can switch your own role to see what each teammate sees.</p>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="preview-role">Your role</Label>
        <Select value={value} onValueChange={(v) => change(v as Member["role"])} disabled={pending}>
          <SelectTrigger id="preview-role" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <dl className="mt-4 border-t border-rule text-sm">
        {roles.map((r) => (
          <div key={r.value} className="flex flex-col gap-0.5 border-b border-rule py-2 sm:flex-row sm:gap-4">
            <dt className="w-32 shrink-0 font-semibold text-ink">{r.label}</dt>
            <dd className="text-ink-muted">{r.can}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
