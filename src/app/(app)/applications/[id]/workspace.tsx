"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, PanelLeft, PanelRight } from "lucide-react";
import type { ApplicationStage, Member, ProposalWorkspace } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { deadlineLabel, formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StageBadge } from "@/components/app/badges";
import { PageContainer } from "@/components/app/page-header";
import { InkStamp } from "@/components/brand/stamp";
import { SectionEditor } from "@/components/proposal/section-editor";
import { Checklist, CompliancePanel, QuestionsPanel, SourcesPanel } from "@/components/proposal/panels";
import { ExportDialog } from "@/components/proposal/export-dialog";
import { stageMeta, stageOrder } from "@/lib/agents/meta";

export function Workspace({ initial, members, orgName, demo }: { initial: ProposalWorkspace; members: Member[]; orgName: string; demo: boolean }) {
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
    try {
      await services.applications.answerMissingFact(id, value);
    } catch (err) {
      toast({ title: "We could not save that", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
      return;
    }
    await reload();
    toast({ title: "Answer saved", description: demo ? "The gap is filled, and it cites you as the source." : "Saved as a fact you stated. The paragraph was rewritten to cite it." });
    setHighlightGap(null);
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
    const r = await services.loop.draftLetter(app.id);
    setDrafting(false);
    if (!r.ok) {
      toast({ title: "We could not write the draft", description: r.error, tone: "warning" });
      return;
    }
    if (demo) {
      toast({ title: "Draft requested", description: "The draft will land in your Inbox when it is ready for you.", tone: "info" });
      return;
    }
    const next = await reload();
    if (next?.sections[0]) setActiveId(next.sections[0].id);
    setPanel(r.data.openQuestions ? "questions" : "checks");
    toast({
      title: "Letter drafted",
      description: r.data.openQuestions ? `${r.data.wordCount} words. ${r.data.openQuestions} question${r.data.openQuestions === 1 ? "" : "s"} for you before it is complete.` : `${r.data.wordCount} words, every claim sourced. Read it over.`,
    });
    router.refresh();
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
        <Link href="/pipeline" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Pipeline
        </Link>
        <header className="mt-4 border-b-2 border-ink pb-6">
          <p className="text-base text-ink-muted">{app.funder.name}</p>
          <h1 className="mt-1 font-display text-h1 text-ink">{app.opportunity.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <StageBadge stage={app.stage} />
            {app.opportunity.deadline ? <span>Due {formatDate(app.opportunity.deadline)}</span> : null}
          </div>
        </header>
        <div className="mt-10 border-t-2 border-ink pt-6">
          <h2 className="font-display text-2xl text-ink">No draft yet</h2>
          <p className="mt-2 max-w-[65ch] text-base text-ink-muted">
            {demo
              ? "We will read the guidelines, build the checklist, and write every section from your facts. Anything we cannot source becomes a question for you instead of a guess. The finished draft arrives in your Inbox."
              : "We will write a one-page letter of inquiry from your confirmed facts and this notice's own text. Every claim carries its source. Anything we cannot source becomes a question for you instead of a guess."}
          </p>
          <Button className="mt-5" onClick={draftNow} loading={drafting}>
            {drafting ? "Writing from your facts" : "Write the first draft"}
          </Button>
          {drafting ? <p className="mt-3 text-sm text-ink-muted" aria-live="polite">About half a minute.</p> : null}
          <div className="mt-10 grid gap-8 opacity-60 sm:grid-cols-3" aria-hidden>
            <div className="border-t border-rule pt-4">
              <Skeleton className="mb-3 h-3 w-24" />
              <SkeletonText lines={4} />
            </div>
            <div className="border-t border-rule pt-4 sm:col-span-2">
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
      <header className="border-b-2 border-ink bg-paper px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/pipeline" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            Pipeline
          </Link>
          <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
            <h1 className="truncate font-display text-xl text-ink">{app.opportunity.title}</h1>
            <p className="flex flex-wrap items-center gap-x-4 text-sm text-ink-muted">
              <span>{app.funder.name}</span>
              {app.askAmount ? <span className="tnum">Asking {formatMoney(app.askAmount)}</span> : null}
              {app.opportunity.deadline ? (
                <>
                  <span>Due {formatDate(app.opportunity.deadline, "MMM d")}</span>
                  <span className={cn(dl.tone === "danger" && "font-semibold text-burgundy")}>{dl.text}</span>
                </>
              ) : null}
              {owner ? <span>{owner.fullName}</span> : null}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-sm text-ink-muted sm:inline" aria-live="polite">
              {saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : ""}
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
              <Link href="/calendar">Milestones</Link>
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)}>
              Export
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
          className={cn("hidden shrink-0 border-r border-rule bg-paper lg:block", leftOpen ? "w-64" : "w-12")}
          aria-label="Checklist"
        >
          <div className="flex items-center justify-between px-2 py-2">
            {leftOpen ? <span className="px-2 text-sm font-semibold text-ink">Requirements</span> : null}
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

        <section className="flex min-w-0 flex-1 flex-col bg-paper" aria-label="Editor">
          {active ? (
            <>
              <div className="flex flex-1 flex-col">
                <SectionEditor key={active.id} section={active} facts={ws.facts} onChange={onChange} onCitationClick={onCitationClick} onGapClick={onGapClick} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-rule bg-paper px-5 py-3 sm:px-10">
                <p className="text-sm text-ink-muted">
                  {active.status === "approved" ? "You approved this section." : active.status === "needs_facts" ? "A few gaps here are waiting on your answers." : "Read it over, then approve it when it sounds like you."}
                </p>
                {active.status === "approved" ? (
                  <div className="flex items-center gap-4">
                    <InkStamp label="Approved" size="sm" rotate={-5} />
                    <Button variant="ghost" size="sm" onClick={approveSection}>
                      Undo approval
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={approveSection}>
                    Approve this section
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </section>

        <aside className={cn("border-t border-rule bg-paper lg:border-l lg:border-t-0", rightOpen ? "lg:w-80" : "lg:w-12")} aria-label="Questions, checks, and sources">
          <div className="hidden items-center justify-between px-2 py-2 lg:flex">
            {rightOpen ? <span className="px-2 text-sm font-semibold text-ink">Review</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={rightOpen ? "Collapse review panel" : "Expand review panel"} aria-expanded={rightOpen} onClick={() => setRightOpen((o) => !o)}>
              <PanelRight />
            </Button>
          </div>
          <div className={cn("px-4 pb-8 lg:px-4", !rightOpen && "lg:hidden")}>
            <Tabs value={panel} onValueChange={(v) => setPanel(v as typeof panel)}>
              <TabsList variant="line" aria-label="Review panels">
                <TabsTrigger value="questions">
                  Questions
                  {openQuestions ? <mark className="highlight text-sm font-semibold tnum">{openQuestions}</mark> : null}
                </TabsTrigger>
                <TabsTrigger value="checks">
                  Checks
                  {fails ? <span className="text-sm font-semibold text-burgundy tnum">{fails}</span> : null}
                </TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
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

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} app={app} sections={ws.sections} orgName={orgName} />
    </div>
  );
}
