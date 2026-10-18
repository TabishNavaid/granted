"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Inbox, Plus, Search } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import { FitScore } from "@/components/app/fit-score";
import { CitationChip, VerifiedSource } from "@/components/app/citation-chip";
import { AgentMark, MilestoneBadge, StageBadge } from "@/components/app/badges";
import { InboxItemCard, type InboxContext } from "@/components/app/inbox-item";
import * as seed from "@/lib/mock/data";
import { stageOrder } from "@/lib/agents/meta";
import { DawnScene, HorizonRule, LanternGlyph, MarginNote, PhotoSlot, SealedLetter, Seedling, Sunrise } from "@/components/brand/illustrations";
import { LanternMark } from "@/components/app/logo";
import { PRODUCT_NAME } from "@/lib/brand";
import type { MilestoneKind } from "@/lib/types";

const colorTokens = [
  ["bg", "Page background"], ["surface", "Card surface"], ["surface-raised", "Raised surface"], ["surface-sunken", "Sunken surface"], ["surface-hover", "Hover"],
  ["border", "Border"], ["border-strong", "Strong border"], ["border-input", "Input border"], ["fg", "Text"], ["fg-muted", "Muted text"], ["fg-subtle", "Subtle text"],
  ["night", "Night"], ["night-raised", "Night raised"], ["night-fg", "Night text"], ["night-muted", "Night muted"],
  ["glow", "Marigold glow"], ["glow-soft", "Glow soft"], ["glow-text", "Glow as text"],
  ["accent", "Terracotta accent"], ["accent-soft", "Accent soft"], ["success", "Success"], ["success-soft", "Success soft"], ["warning", "Warning"], ["warning-soft", "Warning soft"],
  ["danger", "Danger"], ["danger-soft", "Danger soft"], ["info", "Info"], ["info-soft", "Info soft"], ["fit-strong", "Fit strong"], ["fit-good", "Fit good"], ["fit-fair", "Fit fair"],
];
const typeScale = [["text-6xl", "Display"], ["text-5xl", "Hero"], ["text-4xl", "Page title"], ["text-3xl", "Section"], ["text-2xl", "Card title"], ["text-xl", "Subtitle"], ["text-lg", "Lead"], ["text-base", "Body"], ["text-sm", "UI"], ["text-xs", "Caption"], ["text-2xs", "Micro"]];
const spacing = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const radii = ["sm", "md", "lg", "xl"] as const;
const shadows = ["xs", "sm", "md", "lg"] as const;
const tones: BadgeTone[] = ["neutral", "outline", "accent", "success", "warning", "danger", "info"];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 border-t border-border py-10">
      <h2 id={`${id}-t`} className="font-display text-2xl text-fg">
        {title}
      </h2>
      {description ? <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatches() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {colorTokens.map(([t, label]) => (
        <li key={t} className="overflow-hidden rounded-md border border-border">
          <div className="h-14" style={{ background: `var(--${t})` }} />
          <div className="bg-surface px-2.5 py-2">
            <p className="text-xs font-medium text-fg">{label}</p>
            <p className="font-mono text-2xs text-fg-subtle">--{t}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DesignView() {
  const { toast } = useToast();
  const sample = seed.inboxItems.find((i) => i.id === "inbox_email_brightwater")!;
  const ctx: InboxContext = {
    matches: {},
    emails: { [seed.emailDrafts[0].id]: seed.emailDrafts[0] },
    milestones: {},
    missingFacts: {},
    facts: {},
    documents: {},
    funderNames: { funder_brightwater: "Brightwater Industries Giving Program" },
    applicationTitles: {},
  };
  const nav = ["brand", "colors", "type", "spacing", "buttons", "forms", "cards", "badges", "tabs", "overlays", "states", "table", "product"];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="hidden text-sm text-fg-subtle sm:inline">Design system</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/inbox">Open app</Link>
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="py-10">
          <h1 className="font-display text-4xl text-fg">Tokens and components</h1>
          <p className="mt-2 max-w-2xl text-base text-fg-muted">
            Every color, type size, space, radius, and shadow is a CSS variable in globals.css, mapped into Tailwind through the theme block. Switch the theme above to check both modes.
          </p>
          <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-1.5">
            {nav.map((n) => (
              <a key={n} href={`#${n}`} className="rounded-full border border-border px-2.5 py-1 text-xs capitalize text-fg-muted hover:bg-surface-hover hover:text-fg">
                {n}
              </a>
            ))}
          </nav>
        </div>

        <Section id="brand" title="Brand" description={`${PRODUCT_NAME} is a lantern on the path. Night for depth, marigold for light, terracotta for the one action, paper for the ground. A lit lantern means something waits on you; a sealed letter means you approved it.`}>
          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="h-56">
                <DawnScene />
              </div>
              <p className="px-4 py-2 text-xs text-fg-subtle">DawnScene, the hero and closing backdrop. Anchors to the top or the bottom.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-surface p-5">
                <span className="inline-flex items-center gap-2 font-display text-3xl text-fg"><LanternMark /> {PRODUCT_NAME}</span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-night px-4 py-2 font-display text-2xl text-night-fg"><LanternMark /> {PRODUCT_NAME}</span>
              </div>
              <div className="flex flex-wrap items-end gap-6 rounded-2xl border border-border bg-surface p-5 text-fg">
                <figure className="flex flex-col items-center gap-1 text-xs text-fg-subtle"><LanternGlyph size={56} /> lit</figure>
                <figure className="flex flex-col items-center gap-1 text-xs text-fg-subtle"><LanternGlyph size={56} lit={false} /> unlit</figure>
                <figure className="flex flex-col items-center gap-1 text-xs text-fg-subtle"><SealedLetter size={72} /> sealed</figure>
                <figure className="flex flex-col items-center gap-1 text-xs text-fg-subtle"><Seedling size={56} /> seedling</figure>
                <figure className="flex flex-col items-center gap-1 text-xs text-fg-subtle"><Sunrise size={110} /> sunrise</figure>
              </div>
              <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-surface p-5">
                <MarginNote>you have got this</MarginNote>
                <PhotoSlot className="h-20 flex-1" />
              </div>
              <HorizonRule />
            </div>
          </div>
        </Section>

        <Section id="colors" title="Color" description="Night, marigold, terracotta, and paper, each with a job. Status colors appear only where they carry meaning.">
          <Swatches />
          <p className="mt-4 text-xs text-fg-subtle">Night values are defined once under the .dark class. Both themes meet WCAG 2.2 AA for text on their surfaces and 3:1 for control borders.</p>
        </Section>

        <Section id="type" title="Typography" description="Young Serif for headings, Nunito Sans for everything you read at speed, Caveat only for small handwritten notes.">
          <ul className="flex flex-col gap-4">
            {typeScale.map(([cls, label]) => (
              <li key={cls} className="flex flex-col gap-1 border-b border-border pb-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="w-28 shrink-0 font-mono text-2xs text-fg-subtle">{cls}</span>
                <span className={`${cls} ${["text-6xl", "text-5xl", "text-4xl", "text-3xl", "text-2xl", "text-xl"].includes(cls) ? "font-display" : ""} text-fg`}>{label}: Funding that arrives ready to review</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="spacing" title="Spacing, radius, and shadow">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="mb-3 text-sm font-medium text-fg">Spacing (Tailwind scale)</p>
              <ul className="flex flex-col gap-2">
                {spacing.map((s) => (
                  <li key={s} className="flex items-center gap-3 text-xs text-fg-subtle">
                    <span className="w-6 font-mono">{s}</span>
                    <span className="h-3 rounded-sm bg-accent" style={{ width: `${s * 4}px` }} />
                    <span>{s * 4}px</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-fg">Radius</p>
              <ul className="flex flex-wrap gap-3">
                {radii.map((r) => (
                  <li key={r} className="flex flex-col items-center gap-1 text-xs text-fg-subtle">
                    <span className={`size-16 border border-border-strong bg-surface rounded-${r}`} />
                    rounded-{r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-fg">Shadow</p>
              <ul className="flex flex-wrap gap-4">
                {shadows.map((s) => (
                  <li key={s} className="flex flex-col items-center gap-1 text-xs text-fg-subtle">
                    <span className={`size-16 rounded-md bg-surface-raised shadow-${s}`} />
                    shadow-{s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Button" description="One primary action per screen. Secondary and ghost for the rest.">
          <div className="flex flex-col gap-4">
            {(["primary", "secondary", "soft", "ghost", "danger", "danger-ghost", "link"] as const).map((v) => (
              <div key={v} className="flex flex-wrap items-center gap-3">
                <span className="w-24 font-mono text-2xs text-fg-subtle">{v}</span>
                <Button variant={v} size="sm">Small</Button>
                <Button variant={v}>Default</Button>
                <Button variant={v} size="lg">Large</Button>
                <Button variant={v}>
                  <Plus aria-hidden /> With icon
                </Button>
                <Button variant={v} loading>Loading</Button>
                <Button variant={v} disabled>Disabled</Button>
                {v !== "link" ? <Button variant={v} size="icon" aria-label="Search"><Search /></Button> : null}
              </div>
            ))}
          </div>
        </Section>

        <Section id="forms" title="Input, select, and controls" description="Every control has a visible label. Errors are announced with role=alert.">
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
              <Textarea placeholder="A short reason helps the agents do better next time." />
            </Field>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="d-cb1" defaultChecked />
                <Label htmlFor="d-cb1">Checked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="d-cb2" />
                <Label htmlFor="d-cb2">Unchecked</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="d-cb3" disabled />
                <Label htmlFor="d-cb3">Disabled</Label>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch id="d-sw1" defaultChecked />
                <Label htmlFor="d-sw1">On</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="d-sw2" />
                <Label htmlFor="d-sw2">Off</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="d-sw3" disabled />
                <Label htmlFor="d-sw3">Disabled</Label>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2">
              <Label>Progress</Label>
              <Progress value={35} aria-label="35 percent" />
              <Progress value={70} tone="warning" aria-label="70 percent" />
              <Progress value={100} tone="success" aria-label="Complete" />
            </div>
          </div>
        </Section>

        <Section id="cards" title="Card">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Default card</CardTitle>
                <CardDescription>Quiet surface with a hairline border.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-fg-muted">Content sits on the surface token. Cards never nest more than one level deep.</CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
                <Button size="sm" variant="ghost">Cancel</Button>
              </CardFooter>
            </Card>
            <Card interactive>
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>Hover raises it slightly.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-fg-muted">Used for lists where the whole card is a target.</CardContent>
            </Card>
            <Card className="bg-surface-raised">
              <CardHeader>
                <CardTitle>Raised card</CardTitle>
                <CardDescription>For the one thing that matters most on a page.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar name="Dana Okafor" />
                  <div className="text-sm">
                    <p className="font-medium text-fg">Dana Okafor</p>
                    <p className="text-fg-subtle">Executive Director</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="badges" title="Badge, stage, milestone, and agent marks">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <Badge key={t} variant={t} className="capitalize">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {stageOrder.map((s) => (
                <StageBadge key={s} stage={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["deadline", "draft_due", "board_review", "budget_signoff", "submit", "follow_up"] as MilestoneKind[]).map((k) => (
                <MilestoneBadge key={k} kind={k} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(["profile", "discovery", "planner", "proposal", "outreach", "calendar"] as const).map((a) => (
                <span key={a} className="flex items-center gap-2 text-xs text-fg-muted">
                  <AgentMark agent={a} /> {a}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section id="tabs" title="Tabs">
          <div className="flex flex-col gap-6">
            <Tabs defaultValue="a">
              <TabsList aria-label="Line tabs">
                <TabsTrigger value="a">Overview</TabsTrigger>
                <TabsTrigger value="b">Facts <Badge variant="warning" className="px-1.5 py-0">2</Badge></TabsTrigger>
                <TabsTrigger value="c" disabled>Disabled</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="text-sm text-fg-muted">Line tabs for page sections.</TabsContent>
              <TabsContent value="b" className="text-sm text-fg-muted">Second panel.</TabsContent>
            </Tabs>
            <Tabs defaultValue="all">
              <TabsList variant="pill" aria-label="Pill tabs">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="new">New</TabsTrigger>
                <TabsTrigger value="saved">Saved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="text-sm text-fg-muted">Pill tabs for filters.</TabsContent>
            </Tabs>
          </div>
        </Section>

        <Section id="overlays" title="Dialog, toast, and tooltip">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Decline this item?</DialogTitle>
                  <DialogDescription>A short reason helps the agents do better next time. It is optional.</DialogDescription>
                </DialogHeader>
                <Field id="d-reason" label="Reason" optional>
                  <Textarea placeholder="Not a fit because..." className="min-h-20" />
                </Field>
                <DialogFooter>
                  <Button variant="ghost">Keep it</Button>
                  <Button variant="danger">Decline</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" onClick={() => toast({ title: "Draft approved", description: "Moved to Review on your pipeline.", action: { label: "Undo", onClick: () => {} } })}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Could not copy", description: "Select the text and copy it manually.", tone: "warning" })}>
              Warning toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ title: "Plan skipped", description: "We will propose a new one on the 1st.", tone: "info" })}>
              Info toast
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost">Hover or focus me</Button>
              </TooltipTrigger>
              <TooltipContent>Tooltips are for short labels only.</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section id="states" title="Empty and loading states">
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState icon={<Inbox />} title="You are all caught up" description="New drafts, matches, and schedules will land here as the agents finish them." action={<Button variant="secondary">Show everything</Button>} />
            <EmptyState size="sm" icon={<Compass />} title="No matches here" description="Try another filter." />
            <div className="flex flex-col gap-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <Skeleton className="mb-3 h-5 w-1/3" />
              <SkeletonText lines={4} />
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </div>
        </Section>

        <Section id="table" title="Data table" description="Columns can hide below a breakpoint. Numbers are right-aligned and tabular.">
          <DataTable
            caption="Sample funders"
            columns={[
              { key: "name", header: "Funder", cell: (f) => <span className="font-medium text-fg">{f.name}</span> },
              { key: "type", header: "Type", hideBelow: "md", cell: (f) => <span className="capitalize text-fg-muted">{f.type.replace("_", " ")}</span> },
              { key: "geo", header: "Geography", hideBelow: "sm", cell: (f) => f.geography },
              { key: "max", header: "Up to", align: "right", cell: (f) => (f.givingMax ? `$${(f.givingMax / 1000).toFixed(0)}K` : "Varies") },
            ]}
            rows={seed.funders.slice(0, 5)}
            rowKey={(f) => f.id}
          />
        </Section>

        <Section id="product" title="Product components" description="Fit score, citation chips, verified sources, and the Inbox item.">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-8">
              <FitScore score={94} size="lg" />
              <FitScore score={76} size="md" />
              <FitScore score={58} size="sm" />
              <FitScore score={58} size="md" showLabel={false} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CitationChip label="Annual report, p.4" sourceTitle="2025 Annual Report" page={4} excerpt="In 2025 we served 214 young people across our three programs." verifiedAt={seed.facts[0].lastConfirmedAt} />
              <CitationChip size="md" label="Form 990, p.1" sourceTitle="IRS Form 990 (FY2025)" page={1} excerpt="Total expenses: 342,118" />
              <CitationChip label="meridianfamilyfdn.org" kind="web" url="https://meridianfamilyfdn.org/grants" excerpt="Grants range from $10,000 to $50,000." verifiedAt={new Date().toISOString()} />
              <span className="font-display text-lg text-fg">
                Inline: 94% graduated on time <CitationChip label="Annual report, p.6" excerpt="94% of seniors enrolled in After-School Studio graduated on time." /> against 81% district-wide.
              </span>
            </div>
            <VerifiedSource url="https://meridianfamilyfdn.org/grants/youth-development" verifiedAt={seed.opportunities[0].lastVerifiedAt} />
            <div className="max-w-3xl">
              <InboxItemCard item={sample} ctx={ctx} onApprove={() => toast({ title: "Email approved" })} onReject={() => toast({ title: "Declined", tone: "info" })} />
            </div>
            <div className="max-w-3xl">
              <InboxItemCard item={{ ...sample, status: "approved", resolvedAt: new Date().toISOString() }} ctx={ctx} onApprove={() => {}} onReject={() => {}} />
            </div>
            <Button asChild variant="link">
              <Link href="/inbox">
                See the full Inbox <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </Section>
      </main>
    </div>
  );
}
