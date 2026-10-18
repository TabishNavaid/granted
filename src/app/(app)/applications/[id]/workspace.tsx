"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, ChevronDown, Download, PanelLeft, PanelRight, Sparkles } from "lucide-react";
import type { ApplicationStage, Member, ProposalWorkspace } from "@/lib/types";
import { services } from "@/lib/services";
import { runProposalAgent } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { deadlineLabel, formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StageBadge } from "@/components/app/badges";
import { PageContainer } from "@/components/app/page-header";
import { SectionEditor } from "@/components/proposal/section-editor";
import { Checklist, CompliancePanel, QuestionsPanel, SourcesPanel } from "@/components/proposal/panels";
import { ExportDialog } from "@/components/proposal/export-dialog";
import { stageMeta, stageOrder } from "@/lib/agents/meta";

export function Workspace({ initial, members }: { initial: ProposalWorkspace; members: Member[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ws, setWs] = React.useState(initial);
  const [activeId, setActiveId] = React.useState(initial.sections[0]?.id ?? "");
  const [panel, setPanel] = React.useState<"questions" | "checks" | "sources">(initial.missingFacts.some((m) => m.status === "open") ? "questions" : "checks");
  const [highlightFact, setHighlightFact] = React.useState<string | null>(null);
  const [highlightGap, setHighlightGap] = React.useState<string | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = React.useState<"saved" | "saving" | "idle">("idle");

  const app = ws.application;
  const active = ws.sections.find((s) => s.id === activeId) ?? ws.sections[0];
  const dl = deadlineLabel(app.opportunity.deadline);
  const openQuestions = ws.missingFacts.filter((m) => m.status === "open").length;
  const fails = ws.complianceChecks.filter((c) => c.status === "fail").length;
  const owner = members.find((m) => m.id === app.ownerId);

  const reload = React.useCallback(async () => {
    const next = await services.applications.getWorkspace(app.id);
    if (next) setWs(next);
    return next;
  }, [app.id]);

  const onChange = (html: string) => {
    if (!active) return;
    setWs((w) => ({ ...w, sections: w.sections.map((s) => (s.id === active.id ? { ...s, bodyHtml: html, status: s.status === "drafted" ? "edited" : s.status } : s)) }));
    setSaved("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await services.applications.updateSection(active.id, html);
      setSaved("saved");
      const next = await services.applications.getWorkspace(app.id);
      if (next) setWs((w) => ({ ...w, requirements: next.requirements, complianceChecks: next.complianceChecks, sections: w.sections.map((s) => (s.id === active.id ? s : next.sections.find((n) => n.id === s.id) ?? s)) }));
    }, 700);
  };

  const answer = async (id: string, value: string) => {
    await services.applications.answerMissingFact(id, value);
    const next = await reload();
    toast({ title: "Answer saved", description: "The gap is filled, and it cites you as the source." });
    setHighlightGap(null);
    void next;
  };
  const skip = async (id: string) => {
    await services.applications.skipMissingFact(id);
    await reload();
  };

  const rerun = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 900));
    await reload();
    setChecking(false);
    toast({ title: "Checks updated", description: "We looked over the word counts and required items again." });
  };

  const approveSection = async () => {
    if (!active) return;
    const next = await services.applications.setSectionStatus(active.id, active.status === "approved" ? "edited" : "approved");
    setWs((w) => ({ ...w, sections: w.sections.map((s) => (s.id === next.id ? { ...s, status: next.status } : s)) }));
  };

  const moveStage = async (stage: ApplicationStage) => {
    const next = await services.applications.moveStage(app.id, stage);
    setWs((w) => ({ ...w, application: next }));
    toast({ title: `Moved to ${stageMeta[stage].label}` });
    router.refresh();
  };

  const draftNow = async () => {
    setDrafting(true);
    await runProposalAgent({ orgId: app.orgId, applicationId: app.id, askAmount: app.askAmount });
    setDrafting(false);
    toast({ title: "Draft requested", description: "We're on it. The draft will land in your Inbox when it's ready for you.", tone: "info" });
  };

  const onCitationClick = (factId: string) => {
    setPanel("sources");
    setRightOpen(true);
    setHighlightFact(factId);
  };
  const onGapClick = (gapId: string) => {
    setPanel("questions");
    setRightOpen(true);
    setHighlightGap(gapId);
  };

  if (ws.sections.length === 0) {
    return (
      <PageContainer>
        <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Pipeline
        </Link>
        <header className="mt-4">
          <p className="text-sm font-medium text-fg-muted">{app.funder.name}</p>
          <h1 className="mt-1 font-display text-3xl text-fg sm:text-4xl">{app.opportunity.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            <StageBadge stage={app.stage} />
            {app.opportunity.deadline ? <span>Due {formatDate(app.opportunity.deadline)}</span> : null}
          </div>
        </header>
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl text-fg">No draft yet</h2>
              <p className="mt-1 text-sm text-fg-muted">
                We'll read the guidelines, build the checklist, and write every section from your facts. Anything we can't source becomes a question for you instead of a guess. The finished draft arrives in your Inbox.
              </p>
              <Button className="mt-4" onClick={draftNow} loading={drafting}>
                <Sparkles aria-hidden /> Write the first draft
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 opacity-60 sm:grid-cols-3" aria-hidden>
            <div className="rounded-md border border-border p-4">
              <Skeleton className="mb-3 h-3 w-24" />
              <SkeletonText lines={4} />
            </div>
            <div className="rounded-md border border-border p-4 sm:col-span-2">
              <Skeleton className="mb-3 h-4 w-40" />
              <SkeletonText lines={6} />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/pipeline" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Pipeline</span>
          </Link>
          <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
            <h1 className="truncate font-display text-xl text-fg">{app.opportunity.title}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
              <span>{app.funder.name}</span>
              {app.askAmount ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="tnum">Asking {formatMoney(app.askAmount)}</span>
                </>
              ) : null}
              {app.opportunity.deadline ? (
                <>
                  <span aria-hidden>·</span>
                  <span className={cn(dl.tone === "danger" && "text-danger", dl.tone === "warning" && "text-warning")}>
                    Due {formatDate(app.opportunity.deadline)}, {dl.text.toLowerCase()}
                  </span>
                </>
              ) : null}
              {owner ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{owner.fullName}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-xs text-fg-subtle sm:inline" aria-live="polite">
              {saved === "saving" ? "Saving..." : saved === "saved" ? "Saved" : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <StageBadge stage={app.stage} className="-ml-1" /> <ChevronDown className="size-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {stageOrder.filter((s) => s !== "won" && s !== "lost").map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => moveStage(s)} disabled={s === app.stage}>
                    {stageMeta[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/calendar">
                <CalendarDays aria-hidden /> <span>Milestones</span>
              </Link>
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)}>
              <Download aria-hidden /> Export
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 lg:hidden">
          <label htmlFor="section-select" className="sr-only">
            Section
          </label>
          <Select value={active?.id} onValueChange={setActiveId}>
            <SelectTrigger id="section-select" className="h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ws.sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside
          className={cn("hidden shrink-0 border-r border-border bg-surface lg:block", leftOpen ? "w-64" : "w-12")}
          aria-label="Checklist"
        >
          <div className="flex items-center justify-between px-2 py-2">
            {leftOpen ? <span className="px-2 text-xs font-medium text-fg-subtle">Requirements</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={leftOpen ? "Collapse checklist" : "Expand checklist"} aria-expanded={leftOpen} onClick={() => setLeftOpen((o) => !o)}>
              <PanelLeft />
            </Button>
          </div>
          {leftOpen ? (
            <div className="px-3 pb-6">
              <Checklist requirements={ws.requirements} sections={ws.sections} activeId={active?.id ?? ""} onSelect={setActiveId} />
            </div>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-surface-sunken/50" aria-label="Editor">
          {active ? (
            <>
              <div className="flex flex-1 flex-col">
                <SectionEditor key={active.id} section={active} facts={ws.facts} onChange={onChange} onCitationClick={onCitationClick} onGapClick={onGapClick} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3 sm:px-10">
                <p className="text-xs text-fg-subtle">
                  {active.status === "approved" ? "You've approved this section." : active.status === "needs_facts" ? "A few gaps here are waiting on your answers." : "Read it over, then mark it approved when it sounds like you."}
                </p>
                <Button variant={active.status === "approved" ? "secondary" : "soft"} size="sm" onClick={approveSection}>
                  <Check aria-hidden /> {active.status === "approved" ? "Approved" : "Mark section approved"}
                </Button>
              </div>
            </>
          ) : null}
        </section>

        <aside className={cn("border-t border-border bg-surface lg:border-l lg:border-t-0", rightOpen ? "lg:w-80" : "lg:w-12")} aria-label="Questions, checks, and sources">
          <div className="hidden items-center justify-between px-2 py-2 lg:flex">
            {rightOpen ? <span className="px-2 text-xs font-medium text-fg-subtle">Review</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={rightOpen ? "Collapse review panel" : "Expand review panel"} aria-expanded={rightOpen} onClick={() => setRightOpen((o) => !o)}>
              <PanelRight />
            </Button>
          </div>
          <div className={cn("px-4 pb-8 lg:px-4", !rightOpen && "lg:hidden")}>
            <Tabs value={panel} onValueChange={(v) => setPanel(v as typeof panel)}>
              <TabsList className="-mx-1" aria-label="Review panels">
                <TabsTrigger value="questions" className="!px-2.5">
                  Questions
                  {openQuestions ? <Badge variant="warning" className="px-1.5 py-0 tnum">{openQuestions}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="checks" className="!px-2.5">
                  Checks
                  {fails ? <Badge variant="danger" className="px-1.5 py-0 tnum">{fails}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="sources" className="!px-2.5">
                  Sources
                </TabsTrigger>
              </TabsList>
              <TabsContent value="questions">
                <QuestionsPanel questions={ws.missingFacts} sections={ws.sections} highlightId={highlightGap} onAnswer={answer} onSkip={skip} />
              </TabsContent>
              <TabsContent value="checks">
                <CompliancePanel checks={ws.complianceChecks} onRerun={rerun} running={checking} onJump={(id) => setActiveId(id)} />
              </TabsContent>
              <TabsContent value="sources">
                <SourcesPanel facts={ws.facts} documents={ws.documents} sections={ws.sections} highlightFactId={highlightFact} />
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} app={app} sections={ws.sections} />
    </div>
  );
}
