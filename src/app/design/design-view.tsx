"use client";

import * as React from "react";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FitScore } from "@/components/app/fit-score";
import { CitationChip, VerifiedSource } from "@/components/app/citation-chip";
import { MilestoneBadge, StageBadge } from "@/components/app/badges";
import { InboxItemCard, type InboxContext } from "@/components/app/inbox-item";
import { ApprovedMark } from "@/components/brand/approved-mark";
import * as seed from "@/lib/mock/data";
import { stageOrder } from "@/lib/agents/meta";
import type { FunderType, MilestoneKind } from "@/lib/types";

const paperAndInk: { token: string; name: string; note: string }[] = [
  { token: "paper", name: "Paper", note: "#FFFFFF" },
  { token: "paper-tint", name: "Tint", note: "Sunken fields, #F6F7F9" },
  { token: "ink", name: "Ink", note: "All text, #1C2340, 15.4:1" },
  { token: "ink-muted", name: "Ink, soft", note: "Secondary, 6.6:1" },
  { token: "rule", name: "Hairline", note: "Between rows" },
  { token: "rule-strong", name: "Control edge", note: "Fields, 3.4:1" },
  { token: "alert", name: "Alert", note: "Late or wrong, 6.6:1" },
  { token: "focus", name: "Focus", note: "Focus ring, 7.1:1" },
];

const SAMPLE = "Grants for the people doing the work.";
const typeScale: { cls: string; display: boolean }[] = [
  { cls: "text-display", display: true },
  { cls: "text-h1", display: true },
  { cls: "text-3xl", display: true },
  { cls: "text-2xl", display: true },
  { cls: "text-xl", display: true },
  { cls: "text-lg", display: false },
  { cls: "text-base", display: false },
  { cls: "text-sm", display: false },
  { cls: "text-xs", display: false },
];

const tagTones: { tone: BadgeTone; label: string }[] = [
  { tone: "neutral", label: "Discovered" },
  { tone: "accent", label: "Submitted" },
  { tone: "warning", label: "Waiting on you" },
  { tone: "danger", label: "Past due" },
  { tone: "won", label: "Won" },
];
const milestoneKinds: MilestoneKind[] = ["deadline", "draft_due", "board_review", "budget_signoff", "submit", "follow_up"];

const funderTypeLabel: Record<FunderType, string> = {
  private_foundation: "Private foundation",
  community_foundation: "Community foundation",
  corporate: "Corporate giving",
  federal: "Federal",
  state: "State",
  family_fund: "Family fund",
  local_government: "Local government",
  university: "University",
  private_owner: "Private owner",
};

const sections: { id: string; title: string }[] = [
  { id: "color", title: "Color" },
  { id: "type", title: "Type" },
  { id: "approved", title: "Approved" },
  { id: "wordmark", title: "Wordmark" },
  { id: "button", title: "Button" },
  { id: "form", title: "Form" },
  { id: "sheet", title: "Sheet" },
  { id: "tag", title: "Tag" },
  { id: "tabs", title: "Tabs" },
  { id: "overlays", title: "Dialog, toast, and tooltip" },
  { id: "states", title: "Empty and loading" },
  { id: "table", title: "Table" },
  { id: "product", title: "Product" },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20 border-t border-rule py-12">
      <h2 id={`${id}-t`} className="font-display text-3xl text-ink">
        {title}
      </h2>
      {description ? <p className="mt-2 max-w-[60ch] text-base text-ink-muted">{description}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Swatches() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {paperAndInk.map((c) => (
        <li key={c.token} className="overflow-hidden rounded-md border border-rule">
          <div className="h-16" style={{ background: `var(--${c.token})` }} />
          <div className="border-t border-rule px-3 py-2">
            <p className="text-sm font-semibold text-ink">{c.name}</p>
            <p className="text-xs text-ink-muted">{c.note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DesignView() {
  const { toast } = useToast();
  const [bloomKey, setBloomKey] = React.useState(0);
  const sample = seed.inboxItems.find((i) => i.id === "inbox_email_brightwater")!;
  const ctx: InboxContext = {
    matches: {},
    emails: { [seed.emailDrafts[0].id]: seed.emailDrafts[0] },
    milestones: {},
    missingFacts: {},
    facts: {},
    documents: {},
    sections: {},
    funderNames: { funder_brightwater: "Brightwater Industries Giving Program" },
    applicationTitles: {},
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="hidden text-base text-ink-muted sm:inline">Design system</span>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/inbox">Open the app</Link>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="py-12">
          <h1 className="font-display text-h1 text-ink">Tokens and components</h1>
          <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">Every color, size, and component on one page, so a screen can be checked against the meadow it came from.</p>
          <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-base">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-sm text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                {s.title}
              </a>
            ))}
          </nav>
        </div>

        <Section id="color" title="Color" description="White pages, one deep ink close to black with a hint of blue, quiet gray rules. One red for what is late or wrong. No gradients anywhere.">
          <Swatches />
        </Section>

        <Section id="type" title="Type" description="Newsreader for headlines, set at weight 500 with tight spacing and its optical size axis. Atkinson Hyperlegible Next for everything you read, every button, and every field.">
          <ul className="flex flex-col divide-y divide-rule border-y border-rule">
            {typeScale.map((t) => (
              <li key={t.cls} className="flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:gap-8">
                <span className="w-28 shrink-0 text-xs text-ink-muted">{t.cls}</span>
                <span className={`${t.cls} ${t.display ? "font-display" : ""} min-w-0 text-ink`}>{SAMPLE}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="approved" title="Approved" description="When a person approves something, a fellow-green check draws itself beside the confirmation, then leaves with the item. It is the only orchestrated motion in the product.">
          <div className="flex flex-wrap items-center gap-6">
            <p key={bloomKey} className="flex items-center gap-2 text-sm text-ink-muted">
              <ApprovedMark grow className="h-7 w-7" />
              <span className="font-semibold text-ink">Approved</span>
              <span>Just now</span>
            </p>
            <Button variant="secondary" size="sm" onClick={() => setBloomKey((k) => k + 1)}>
              Play it again
            </Button>
          </div>
        </Section>

        <Section id="wordmark" title="Wordmark" description="The mark, two Fs facing under one beam, and the name in Public Sans semibold.">
          <div className="flex flex-col items-start gap-8">
            <Wordmark size="xl" />
            <Wordmark size="md" />
          </div>
        </Section>

        <Section id="button" title="Button" description="One primary action per screen, in ink. The text face, a modest corner, and the label says what happens. Never an arrow.">
          <div className="flex flex-col divide-y divide-rule border-y border-rule">
            {(["primary", "secondary", "ghost", "danger", "danger-ghost", "link"] as const).map((v) => (
              <div key={v} className="flex flex-wrap items-center gap-4 py-4">
                <span className="w-28 text-xs text-ink-muted">{v}</span>
                <Button variant={v} size="sm">
                  Approve draft
                </Button>
                <Button variant={v}>Approve draft</Button>
                <Button variant={v} size="lg">
                  Approve draft
                </Button>
                <Button variant={v} loading>
                  Approving
                </Button>
                <Button variant={v} disabled>
                  Approve draft
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section id="form" title="Form" description="White fields with a border that reads at 3:1, the label above, and the error said in words.">
          <div className="grid max-w-3xl gap-6 md:grid-cols-2">
            <Field id="d-default" label="Default" hint="Helper text goes here.">
              <Input placeholder="Placeholder" />
            </Field>
            <Field id="d-filled" label="Filled">
              <Input defaultValue="Riverbend Youth Collective" />
            </Field>
            <Field id="d-error" label="With error" error="An EIN has 9 digits.">
              <Input defaultValue="47-338" />
            </Field>
            <Field id="d-disabled" label="Disabled">
              <Input disabled defaultValue="Cannot edit" />
            </Field>
            <Field id="d-select" label="Select">
              <Select defaultValue="fit">
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit">Best fit</SelectItem>
                  <SelectItem value="deadline">Soonest deadline</SelectItem>
                  <SelectItem value="amount">Largest award</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="d-textarea" label="Textarea" optional>
              <Textarea placeholder="A short reason helps the next one fit better." />
            </Field>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Checkbox id="d-cb1" defaultChecked />
                <Label htmlFor="d-cb1">Checked</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="d-cb2" />
                <Label htmlFor="d-cb2">Unchecked</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="d-cb3" disabled />
                <Label htmlFor="d-cb3">Disabled</Label>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch id="d-sw1" defaultChecked />
                <Label htmlFor="d-sw1">On</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="d-sw2" />
                <Label htmlFor="d-sw2">Off</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="d-sw3" disabled />
                <Label htmlFor="d-sw3">Disabled</Label>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2">
              <Label>Progress</Label>
              <Progress value={35} aria-label="35 percent" />
              <Progress value={70} aria-label="70 percent" />
              <Progress value={100} aria-label="Complete" />
            </div>
          </div>
        </Section>

        <Section id="sheet" title="Sheet" description="A sheet is white with one hairline. A raised sheet lies on top of the page with a soft lift.">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="sheet p-5">
              <p className="text-base text-ink">A sheet sits flat on the page, for a form or a plan that belongs to this screen.</p>
            </div>
            <div className="sheet-raised p-5">
              <p className="text-base text-ink">A raised sheet lies on top of the page, for a dialog, a popover, or the one item that matters most.</p>
            </div>
          </div>
        </Section>

        <Section id="tag" title="Tag" description="Sentence case inside a thin rule, used only where a status is a fact. Waiting on you is solid ink.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {tagTones.map((t) => (
                <Badge key={t.tone} variant={t.tone}>
                  {t.label}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {stageOrder.map((s) => (
                <StageBadge key={s} stage={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {milestoneKinds.map((k) => (
                <MilestoneBadge key={k} kind={k} />
              ))}
            </div>
          </div>
        </Section>

        <Section id="tabs" title="Tabs" description="A row of plain words. The current one is bold with an ink line under it.">
          <div className="flex flex-col gap-8">
            <Tabs defaultValue="a">
              <TabsList aria-label="Line tabs">
                <TabsTrigger value="a">Overview</TabsTrigger>
                <TabsTrigger value="b">
                  Facts <span className="text-sm text-ink-muted tnum">2</span>
                </TabsTrigger>
                <TabsTrigger value="c" disabled>
                  Disabled
                </TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="text-base text-ink-muted">
                Line tabs sit on a page rule and divide a page into sections.
              </TabsContent>
              <TabsContent value="b" className="text-base text-ink-muted">
                Second panel.
              </TabsContent>
            </Tabs>
            <Tabs defaultValue="all">
              <TabsList variant="pill" aria-label="Filter tabs">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="new">New</TabsTrigger>
                <TabsTrigger value="saved">Saved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="text-base text-ink-muted">
                Filter tabs live inside a section, without the rule.
              </TabsContent>
            </Tabs>
          </div>
        </Section>

        <Section id="overlays" title="Dialog, toast, and tooltip">
          <div className="flex flex-wrap items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Decline this?</DialogTitle>
                  <DialogDescription>A short reason helps the next one fit better. It is optional.</DialogDescription>
                </DialogHeader>
                <Field id="d-reason" label="Reason" optional>
                  <Textarea placeholder="Not for us because" className="min-h-20" />
                </Field>
                <DialogFooter>
                  <Button variant="ghost">Keep it</Button>
                  <Button variant="danger">Decline</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" onClick={() => toast({ title: "Draft approved", description: "It is in Review on your pipeline now.", tone: "success", action: { label: "Undo", onClick: () => {} } })}>
              Approval toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Could not copy", description: "Select the text and copy it yourself.", tone: "warning" })}>
              Warning toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Plan skipped", description: "A fresh one arrives on the 1st.", tone: "info" })}>
              Plain toast
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover or focus me</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltips are for short labels only.</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section id="states" title="Empty and loading" description="Nothing here is a plain sentence on a quiet tint. Loading is a plain block of tint.">
          <div className="grid gap-8 md:grid-cols-2">
            <EmptyState title="You are caught up" description="New drafts, funders, and schedules land here as they are ready." action={<Button variant="secondary">Show everything</Button>} />
            <EmptyState size="sm" title="No funders here" description="Try another filter." />
            <div className="flex flex-col md:col-span-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </Section>

        <Section id="table" title="Table" description="Hairlines between rows, a tinted header, no frame. Numbers are right-aligned and tabular.">
          <DataTable
            caption="Sample funders"
            columns={[
              { key: "name", header: "Funder", cell: (f) => <span className="font-semibold text-ink">{f.name}</span> },
              { key: "type", header: "Type", hideBelow: "md", cell: (f) => <span className="text-ink-muted">{funderTypeLabel[f.type]}</span> },
              { key: "geo", header: "Geography", hideBelow: "sm", cell: (f) => f.geography },
              { key: "max", header: "Up to", align: "right", cell: (f) => (f.givingMax ? `$${(f.givingMax / 1000).toFixed(0)}K` : "Varies") },
            ]}
            rows={seed.funders.slice(0, 5)}
            rowKey={(f) => f.id}
          />
        </Section>

        <Section id="product" title="Product" description="Fit score, citations, verified sources, and the Inbox item, waiting and approved.">
          <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-end gap-10">
              <FitScore score={94} size="lg" />
              <FitScore score={76} size="md" />
              <FitScore score={58} size="sm" />
              <FitScore score={58} size="md" showLabel={false} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <CitationChip label="Annual report, p.4" sourceTitle="2025 Annual Report" page={4} excerpt="In 2025 we served 214 young people across our three programs." verifiedAt={seed.facts[0].lastConfirmedAt} />
              <CitationChip size="md" label="Form 990, p.1" sourceTitle="IRS Form 990 (FY2025)" page={1} excerpt="Total expenses: 342,118" />
              <CitationChip label="meridianfamilyfdn.org" kind="web" url="https://meridianfamilyfdn.org/grants" excerpt="Grants range from $10,000 to $50,000." verifiedAt={new Date().toISOString()} />
            </div>
            <p className="max-w-[60ch] text-lg text-ink">
              Inline: 94% graduated on time <CitationChip label="Annual report, p.6" excerpt="94% of seniors enrolled in After-School Studio graduated on time." /> against 81% district-wide.
            </p>
            <VerifiedSource url="https://meridianfamilyfdn.org/grants/youth-development" verifiedAt={seed.opportunities[0].lastVerifiedAt} />
            <div className="max-w-3xl border-t border-rule">
              <InboxItemCard item={sample} ctx={ctx} onApprove={() => toast({ title: "Email approved" })} onReject={() => toast({ title: "Declined", tone: "info" })} />
            </div>
            <div className="max-w-3xl border-t border-rule">
              <InboxItemCard item={{ ...sample, status: "approved", resolvedAt: new Date().toISOString() }} ctx={ctx} onApprove={() => {}} onReject={() => {}} />
            </div>
            <Button asChild variant="link" className="self-start">
              <Link href="/inbox">See the full Inbox</Link>
            </Button>
          </div>
        </Section>
      </main>
    </div>
  );
}
