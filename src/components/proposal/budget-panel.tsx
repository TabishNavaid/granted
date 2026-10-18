"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import type { Budget, BudgetCategory, BudgetLine } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUDGET_CATEGORY_LABEL, budgetTotal } from "@/lib/loop/budget";
import { formatMoney } from "@/lib/format";

const categories = Object.keys(BUDGET_CATEGORY_LABEL) as BudgetCategory[];

/** A simple table that becomes a budget and a justification. Saves as you go. */
export function BudgetPanel({ budget, onSave, onJustify, onAddSection, busy }: { budget: Budget | null; onSave: (lines: BudgetLine[], justification: string) => Promise<void>; onJustify: () => Promise<string | null>; onAddSection: () => void; busy: string | null }) {
  const [lines, setLines] = React.useState<BudgetLine[]>(budget?.lines ?? []);
  const [justification, setJustification] = React.useState(budget?.justification ?? "");
  const counter = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (next: BudgetLine[], j = justification) => {
    setLines(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void onSave(next, j), 600);
  };
  const update = (id: string, patch: Partial<BudgetLine>) => save(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = () => {
    counter.current += 1;
    save([...lines, { id: `bl_${budget?.id ?? "new"}_${counter.current}_${lines.length}`, category: "personnel", item: "", amount: 0, note: "" }]);
  };
  const justify = async () => {
    const text = await onJustify();
    if (text !== null) setJustification(text);
  };
  const total = budgetTotal(lines);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">Each line is what the money buys and why. The justification is written only from these lines and your facts.</p>
      <ul className="border-t border-rule">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-col gap-2 border-b border-rule py-3">
            <div className="flex gap-2">
              <Select value={l.category} onValueChange={(v) => update(l.id, { category: v as BudgetCategory })}>
                <SelectTrigger aria-label="Category" className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {BUDGET_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label="Amount" inputMode="numeric" className="h-9 w-28 tnum" value={l.amount || ""} onChange={(e) => update(l.id, { amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} placeholder="$" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => save(lines.filter((x) => x.id !== l.id))}>
                <Trash2 />
              </Button>
            </div>
            <Input aria-label="Item" className="h-9" value={l.item} onChange={(e) => update(l.id, { item: e.target.value })} placeholder="What it buys" />
            <Input aria-label="Note" className="h-9" value={l.note} onChange={(e) => update(l.id, { note: e.target.value })} placeholder="Why it is needed, in a few words" />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={add}>
          Add a line
        </Button>
        <p className="text-sm text-ink">
          Total <span className="font-display text-xl tnum">{formatMoney(total)}</span>
        </p>
      </div>
      <div className="border-t border-rule pt-4">
        <p className="text-sm font-semibold text-ink">Justification</p>
        <Textarea className="mt-2" rows={6} value={justification} onChange={(e) => { setJustification(e.target.value); save(lines, e.target.value); }} placeholder="Write it yourself, or ask for a draft from the lines above." />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={justify} loading={busy === "justify"} disabled={!lines.length}>
            Write the justification
          </Button>
          <Button variant="secondary" size="sm" onClick={onAddSection} loading={busy === "section"} disabled={!lines.length}>
            Put it in the draft
          </Button>
        </div>
      </div>
    </div>
  );
}
