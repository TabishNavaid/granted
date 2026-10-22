"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, PanelLeft, PanelRight } from "lucide-react";
import type { ApplicationStage, Budget, BudgetLine, Member, ProposalWorkspace, ReviewerCheck, SectionVersion } from "@/lib/types";
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
import { ApprovedMark } from "@/components/brand/approved-mark";
import { SectionEditor } from "@/components/proposal/section-editor";
import { Checklist, CompliancePanel, QuestionsPanel, SourcesPanel } from "@/components/proposal/panels";
import { ExportDialog } from "@/components/proposal/export-dialog";
import { ReviewerPanel } from "@/components/proposal/reviewer-panel";
import { BudgetPanel } from "@/components/proposal/budget-panel";
import { VersionsDialog } from "@/components/proposal/versions-dialog";
import { AskSuggestion, LogicModelDialog, ReuseDialog, WinKitDialog } from "@/components/proposal/feature-dialogs";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { finalJob, newJobId, watchJob, runLong } from "@/lib/progress-client";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { stageMeta, stageOrder } from "@/lib/agents/meta";
import { MODE_LABELS } from "@/lib/segments";

const LETTER_FALLBACK: JobView = { status: "running", steps: [{ label: "Reading the notice and your confirmed facts", state: "active" }, { label: "Writing the letter", state: "pending" }, { label: "Checking every citation and number", state: "pending" }] };
const MODE_LABEL = MODE_LABELS;
const PROPOSAL_FALLBACK: JobView = { status: "running", steps: [{ label: "Reading the funder's guidelines", state: "active" }, { label: "Building the requirements checklist", state: "pending" }, { label: "Drafting every section from your facts", state: "pending" }, { label: "Checking every citation and number", state: "pending" }] };

export function Workspace({ initial, members, orgName, demo, reviewer: initialReviewer, budget: initialBudget, role }: { initial: ProposalWorkspace; members: Member[]; orgName: string; demo: boolean; reviewer: ReviewerCheck | null; budget: Budget | null; role: Member["role"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const params = useSearchParams();
  const [ws, setWs] = React.useState(initial);
  // A link can open a particular section, e.g. from the compliance matrix.
  const [activeId, setActiveId] = React.useState(() => {
    const want = params.get("section");
    return want && initial.sections.some((x) => x.id === want) ? want : (initial.sections[0]?.id ?? "");
  });
  const [panel, setPanel] = React.useState<"questions" | "checks" | "sources" | "reviewer" | "budget">(initial.missingFacts.some((m) => m.status === "open") ? "questions" : "checks");
  const [reviewer, setReviewer] = React.useState<ReviewerCheck | null>(initialReviewer);
  const [budget, setBudget] = React.useState<Budget | null>(initialBudget);
  const [panelBusy, setPanelBusy] = React.useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<SectionVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = React.useState(false);
  const [job, setJob] = React.useState<JobView | null>(null);
  const [askOpen, setAskOpen] = React.useState(false);
  const [askValue, setAskValue] = React.useState(initial.application.askAmount ? String(initial.application.askAmount) : "");
  const [justApproved, setJustApproved] = React.useState<string | null>(null);
  const [highlightFact, setHighlightFact] = React.useState<string | null>(null);
  const [highlightGap, setHighlightGap] = React.useState<string | null>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [drafting, setDrafting] = React.useState<false | "letter" | "proposal" | "concept">(false);
  const [logicOpen, setLogicOpen] = React.useState(false);
  const [reuseOpen, setReuseOpen] = React.useState(false);
  const [kitOpen, setKitOpen] = React.useState(false);
  // Board reviewers read and approve sections; everything that changes the draft is hidden for them.
  const readOnly = role === "reviewer";
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  // Between 1024 and 1280px there is no room for both side panels and a readable editor, so the checklist starts closed.
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const t = setTimeout(() => {
      if (mq.matches) setLeftOpen(false);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = React.useState<"saved" | "saving" | "idle">("idle");

  const app = ws.application;
  const isBid = app.mode === "bid" || app.mode === "sf330";
  const segmentMode = isBid || app.mode === "research" || app.mode === "essay";
  const [essayPrompt, setEssayPrompt] = React.useState(demo && app.mode === "essay" ? "Tell us about a time you took responsibility for something in your community, and how it shaped what you want to study." : "");
  const draftSegment = async () => {
    const jobId = newJobId();
    const fallback: JobView = { status: "running", steps: app.mode === "essay" ? [{ label: "Reading the prompt and your experiences", state: "active" }, { label: "Writing in your voice", state: "pending" }, { label: "Checking every detail against your résumé", state: "pending" }] : [{ label: "Reading the notice, the team's records, and the funder's AI rules", state: "active" }, { label: "Writing the sections", state: "pending" }, { label: "Building biosketches and facilities from your records", state: "pending" }, { label: "Checking every citation and number", state: "pending" }] };
    setDrafting("proposal");
    setJob(fallback);
    const stop = watchJob(jobId, setJob);
    const r = app.mode === "essay" ? await runLong(jobId, "person.draftEssay", [app.id, essayPrompt, jobId], () => services.person.draftEssay(app.id, essayPrompt, jobId)) : await runLong(jobId, "research.draftProposal", [app.id, jobId], () => services.research.draftProposal(app.id, jobId));
    stop();
    if (!r.ok) {
      setDrafting(false);
      setJob(null);
      toast({ title: "We could not write the draft", description: r.error, tone: "warning" });
      return;
    }
    setJob(await finalJob(jobId, fallback));
    await new Promise((res) => setTimeout(res, 900));
    setDrafting(false);
    setJob(null);
    const next = await reload();
    if (next?.sections[0]) setActiveId(next.sections[0].id);
    setPanel(next?.missingFacts.some((m) => m.status === "open") ? "questions" : "checks");
    router.refresh();
  };
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
      try {
        await services.applications.updateSection(active.id, html);
      } catch (err) {
        setSaved("idle");
        failed("We could not save that change", err);
        return;
      }
      setSaved("saved");
      const next = await services.applications.getWorkspace(app.id);
      if (next) setWs((w) => ({ ...w, requirements: next.requirements, complianceChecks: next.complianceChecks, sections: w.sections.map((s) => (s.id === active.id ? s : next.sections.find((n) => n.id === s.id) ?? s)) }));
    }, 700);
  };

  const failed = (title: string, err: unknown) => toast({ title, description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });

  const answer = async (id: string, value: string) => {
    try {
      await services.applications.answerMissingFact(id, value);
    } catch (err) {
      toast({ title: "We could not save that", description: err instanceof Error ? err.message : "Try again in a moment.", tone: "warning" });
      return;
    }
    await reload();
    toast({ title: "Answer saved", description: "Saved as a fact you stated. It is in the letter now and cites you as the source." });
    setHighlightGap(null);
  };
  const skip = async (id: string) => {
    try {
      await services.applications.skipMissingFact(id);
    } catch (err) {
      return failed("We could not skip that", err);
    }
    await reload();
  };

  const rerun = async () => {
    setChecking(true);
    try {
      const checks = await services.applications.runChecks(app.id);
      setWs((w) => ({ ...w, complianceChecks: checks }));
      const failing = checks.filter((c) => c.status === "fail").length;
      toast({ title: "Checks updated", description: failing ? `${failing} check${failing === 1 ? "" : "s"} failed against the current draft and documents.` : "Word counts, required items, citations, and open questions checked against the current draft." });
    } catch (err) {
      failed("We could not run the checks", err);
    } finally {
      setChecking(false);
    }
  };

  const approveSection = async () => {
    if (!active) return;
    const approving = active.status !== "approved";
    let next;
    try {
      next = await services.applications.setSectionStatus(active.id, approving ? "approved" : "edited");
    } catch (err) {
      return failed("We could not change the approval", err);
    }
    setJustApproved(approving ? active.id : null);
    setWs((w) => ({ ...w, sections: w.sections.map((s) => (s.id === next.id ? { ...s, status: next.status } : s)) }));
  };

  const moveStage = async (stage: ApplicationStage) => {
    let next;
    try {
      next = await services.applications.moveStage(app.id, stage);
    } catch (err) {
      return failed("We could not move it", err);
    }
    setWs((w) => ({ ...w, application: next }));
    toast(stage === "submitted" && !app.submittedAt ? { title: "Moved to Submitted", description: "A follow-up reminder is on the calendar for 30 days from today, and a follow-up email is drafted in Outreach." } : { title: `Moved to ${stageMeta[stage].label}` });
    router.refresh();
  };

  const drainedRef = React.useRef<(() => void) | null>(null);
  const onDrained = React.useCallback(() => {
    drainedRef.current?.();
    drainedRef.current = null;
  }, []);
  const draftNow = async (mode: "letter" | "proposal" = app.mode === "proposal" ? "proposal" : "letter") => {
    setDrafting(mode);
    const jobId = newJobId();
    setJob(mode === "proposal" ? PROPOSAL_FALLBACK : LETTER_FALLBACK);
    const stop = watchJob(jobId, setJob);
    let r: Awaited<ReturnType<typeof services.loop.draftLetter>> | Awaited<ReturnType<typeof services.loop.draftProposal>>;
    try {
      r = mode === "proposal" ? await runLong(jobId, "loop.draftProposal", [app.id, jobId], () => services.loop.draftProposal(app.id, jobId)) : await runLong(jobId, "loop.draftLetter", [app.id, jobId], () => services.loop.draftLetter(app.id, jobId));
    } catch (err) {
      stop();
      setDrafting(false);
      setJob(null);
      return failed("We could not write the draft", err);
    }
    stop();
    if (!r.ok) {
      setDrafting(false);
      setJob(null);
      toast({ title: "We could not write the draft", description: r.error, tone: "warning" });
      return;
    }
    const last = await finalJob(jobId, mode === "proposal" ? PROPOSAL_FALLBACK : LETTER_FALLBACK);
    setJob(last);
    // Let every paragraph and question arrive in the feed before the editor replaces it.
    if (last.events?.length) await new Promise<void>((res) => (drainedRef.current = res));
    await new Promise((res) => setTimeout(res, 1200));
    setDrafting(false);
    setJob(null);
    const next = await reload();
    if (next?.sections[0]) setActiveId(next.sections[0].id);
    setPanel(r.data.openQuestions ? "questions" : "checks");
    toast({
      title: mode === "proposal" ? "Proposal drafted" : "Letter drafted",
      description: r.data.openQuestions ? `${r.data.wordCount} words. ${r.data.openQuestions} question${r.data.openQuestions === 1 ? "" : "s"} for you before it is complete.` : `${r.data.wordCount} words, every claim sourced. Read it over.`,
    });
    router.refresh();
  };

  const draftConcept = async () => {
    setDrafting("concept");
    try {
      const r = await services.applications.draftConceptNote(app.id);
      if (!r.ok) return toast({ title: "We could not write the concept note", description: r.error, tone: "warning" });
      const next = await reload();
      if (next?.sections[0]) setActiveId(next.sections[0].id);
      setPanel(r.data.openQuestions ? "questions" : "checks");
      toast({ title: "Concept note written", description: `${r.data.sectionCount} short sections from your confirmed facts.${r.data.openQuestions ? ` ${r.data.openQuestions} question${r.data.openQuestions === 1 ? "" : "s"} where a fact is missing.` : ""}` });
      router.refresh();
    } catch (err) {
      failed("We could not write the concept note", err);
    } finally {
      setDrafting(false);
    }
  };
  const afterReuse = async () => {
    const next = await reload();
    if (next?.sections[0]) setActiveId(next.sections[0].id);
    setPanel(next?.missingFacts.some((m) => m.status === "open") ? "questions" : "checks");
    router.refresh();
  };
  const afterLogicModel = async (sectionId: string) => {
    await reload();
    setActiveId(sectionId);
  };

  // Arriving from "Draft a letter" in setup: start writing at once, with the progress on screen.
  const autoStarted = React.useRef(false);
  React.useEffect(() => {
    if (autoStarted.current || readOnly || initial.sections.length || params.get("draft") !== "letter") return;
    const t = setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      router.replace(`/applications/${initial.application.id}`, { scroll: false });
      void draftNow("letter");
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runReviewer = async () => {
    setPanelBusy("reviewer");
    let r;
    try {
      r = await services.applications.runReviewerCheck(app.id);
    } catch (err) {
      setPanelBusy(null);
      return failed("Could not score the draft", err);
    }
    setPanelBusy(null);
    if (!r.ok) return toast({ title: "Could not score the draft", description: r.error, tone: "warning" });
    setReviewer(r.data);
    toast({ title: `Scored ${r.data.overall} of 100`, description: r.data.summary.startsWith("Rule-based review") ? "A rule-based count of words, citations, and open questions. One fix per part is in the Reviewer panel." : "One fix per criterion is in the Reviewer panel." });
  };
  const saveBudget = async (lines: BudgetLine[], justification: string) => {
    try {
      setBudget(await services.applications.saveBudget(app.id, lines, justification));
    } catch (err) {
      failed("We could not save the budget", err);
    }
  };
  const justify = async () => {
    setPanelBusy("justify");
    let r;
    try {
      r = await services.applications.writeBudgetJustification(app.id);
    } catch (err) {
      setPanelBusy(null);
      failed("Could not write it", err);
      return null;
    }
    setPanelBusy(null);
    if (!r.ok) {
      toast({ title: "Could not write it", description: r.error, tone: "warning" });
      return null;
    }
    setBudget(r.data);
    toast({ title: "Justification written", description: "Read it over. Any number we could not source is bracketed." });
    return r.data.justification;
  };
  const addBudgetSection = async () => {
    setPanelBusy("section");
    let sec;
    try {
      sec = await services.applications.addBudgetSection(app.id);
    } catch (err) {
      setPanelBusy(null);
      return failed("We could not add the budget", err);
    }
    setPanelBusy(null);
    await reload();
    setActiveId(sec.id);
    toast({ title: "Budget added to the draft", description: "It is a section like any other now." });
  };
  const openVersions = async () => {
    if (!active) return;
    setVersionsOpen(true);
    setVersionsLoading(true);
    setVersions(await services.applications.listVersions(active.id));
    setVersionsLoading(false);
  };
  const restore = async (versionId: string) => {
    try {
      await services.applications.restoreVersion(versionId);
    } catch (err) {
      return failed("We could not restore it", err);
    }
    setVersionsOpen(false);
    await reload();
    toast({ title: "Version restored", description: "The text it replaced is saved as a version too." });
  };
  const planMilestones = async () => {
    let ms;
    try {
      ms = await services.calendar.planMilestones(app.id, { boardReview: true });
    } catch (err) {
      return failed("We could not plan the milestones", err);
    }
    toast({ title: ms.length ? `${ms.length} milestones planned` : "No deadline to plan from", description: ms.length ? "Worked back from the deadline. See them on the Calendar." : "This notice has no posted deadline." });
    router.refresh();
  };
  const saveAsk = async () => {
    const n = Number(askValue.replace(/[^0-9.]/g, ""));
    let next;
    try {
      next = await services.applications.setAskAmount(app.id, Number.isFinite(n) && n > 0 ? Math.round(n) : null);
    } catch (err) {
      return failed("We could not save the ask", err);
    }
    setWs((w) => ({ ...w, application: next }));
    setAskOpen(false);
    toast({ title: next.askAmount ? `Ask set to ${formatMoney(next.askAmount)}` : "Ask cleared", description: next.askAmount ? "The draft and budget use this amount as written." : "The draft will ask you for the amount instead of guessing." });
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
        <Link href={isBid ? `/applications/${app.id}` : "/pipeline"} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          {isBid ? "Bid: matrix, go/no-go, fee" : "Pipeline"}
        </Link>
        <header className="mt-4 border-b border-rule pb-6">
          <p className="text-base text-ink-muted">{app.funder.name}</p>
          <h1 className="mt-1 font-display text-title text-ink">{app.opportunity.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
            <StageBadge stage={app.stage} />
            {app.opportunity.deadline ? <span>Due {formatDate(app.opportunity.deadline)}</span> : null}
          </div>
        </header>
        <div className="mt-10 border-t border-rule pt-6">
          <h2 className="font-display text-2xl text-ink">{drafting ? (drafting === "letter" ? "Writing the letter" : drafting === "concept" ? "Writing the concept note" : "Drafting the proposal") : "No draft yet"}</h2>
          {segmentMode ? (
            isBid ? (
              <p className="mt-2 max-w-[65ch] text-base text-ink-muted">
                Bids are drafted from their bid page, where the compliance matrix, go/no-go, team, and fee live.{" "}
                <Link href={`/applications/${app.id}`} className="font-semibold text-ink underline underline-offset-4">
                  Go to the bid
                </Link>
              </p>
            ) : app.mode === "research" ? (
              <>
                <p className="mt-2 max-w-[65ch] text-base text-ink-muted">We draft the standard sections (summary, aims, research plan, broader impacts, budget justification, data management plan) from your team&apos;s records and the notice, and build biosketches and facilities straight from your records. Anything we cannot source becomes a question.</p>
                {app.funder.aiPolicy ? <p className="mt-3 max-w-[65ch] border-l-[6px] border-alert py-1 pl-4 text-base text-ink">{app.funder.aiPolicy}</p> : <p className="mt-3 max-w-[65ch] border-l-[3px] border-rule-strong py-1 pl-4 text-base text-ink">We found no AI policy for this funder. Search the notice for an AI clause before using drafted text.</p>}
                {!readOnly ? (
                  <Button className="mt-5" onClick={draftSegment} loading={Boolean(drafting)} disabled={Boolean(drafting)}>
                    Draft the research proposal
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Paste the sponsor&apos;s essay prompt. We draft from your own experiences, in your voice, and ask for any detail your résumé does not give rather than invent it.</p>
                <div className="mt-4 max-w-2xl">
                  <Field id="essay-prompt" label="The essay prompt">
                    <Textarea value={essayPrompt} onChange={(e) => setEssayPrompt(e.target.value)} rows={3} />
                  </Field>
                  {demo ? <p className="mt-1 text-sm text-ink-muted">An example prompt. A sponsor&apos;s own prompt is in its application.</p> : null}
                </div>
                {!readOnly ? (
                  <Button className="mt-5" onClick={draftSegment} loading={Boolean(drafting)} disabled={Boolean(drafting) || essayPrompt.trim().length < 15}>
                    Draft my essay
                  </Button>
                ) : null}
              </>
            )
          ) : (
            <>
          <p className="mt-2 max-w-[65ch] text-base text-ink-muted">
              {demo
                ? "Write a one-page letter of inquiry from the confirmed facts and this funder's own text. Every claim carries its source, and anything we cannot source becomes a question instead of a guess. The demo replays recorded letters for each sample's strongest matches."
                : "We will write a one-page letter of inquiry from your confirmed facts and this funder's own text. Every claim carries its source. Anything we cannot source becomes a question for you instead of a guess."}
            </p>
            {readOnly ? (
              <p className="mt-5 max-w-[60ch] text-sm text-ink-muted">You are reading as a board reviewer. The owner or an editor starts the draft; you can read and approve sections once it is written.</p>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => draftNow("letter")} loading={drafting === "letter"} disabled={Boolean(drafting)}>
                    {drafting === "letter" ? "Writing from your facts" : "Write a letter of inquiry"}
                  </Button>
                  <Button variant="secondary" onClick={() => draftNow("proposal")} loading={drafting === "proposal"} disabled={Boolean(drafting)}>
                    {drafting === "proposal" ? "Drafting the proposal" : "Write the full proposal"}
                  </Button>
                  <Button variant="secondary" onClick={draftConcept} loading={drafting === "concept"} disabled={Boolean(drafting)}>
                    Write a concept note
                  </Button>
                </div>
                <p className="mt-3 max-w-[60ch] text-sm text-ink-muted">A letter is one page and takes about half a minute. The full proposal reads the funder&apos;s guidelines into a checklist first and takes a minute or two. A concept note is a short outline assembled straight from your confirmed facts, with no model, so it is ready in a second.</p>
                <p className="mt-4 text-sm text-ink-muted">
                  Or{" "}
                  <button type="button" onClick={() => setReuseOpen(true)} disabled={Boolean(drafting)} className="inline-flex min-h-6 items-center font-semibold text-ink underline decoration-[1.5px] underline-offset-4 disabled:opacity-50">
                    start from a past winning application
                  </button>
                  .
                </p>
              </>
            )}
              </>
          )}
          {job ? (
            <div className="mt-6 max-w-2xl" aria-live="polite">
              <ProgressSteps job={job} onDrained={onDrained} />
            </div>
          ) : null}
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
        <ReuseDialog applicationId={app.id} open={reuseOpen} onOpenChange={setReuseOpen} onDone={afterReuse} />
      </PageContainer>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-paper px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={isBid ? `/applications/${app.id}` : "/pipeline"} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
            {isBid ? "Bid: matrix, go/no-go, fee" : "Pipeline"}
          </Link>
          <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
            <h1 className="truncate font-display text-xl text-ink">{app.opportunity.title}</h1>
            <p className="flex flex-wrap items-center gap-x-4 text-sm text-ink-muted">
              <span>{app.funder.name}</span>
              <span>{MODE_LABEL[app.mode] ?? "Letter of inquiry"}</span>
              {/* The amount is a fact, so it is plain text. Only the control that changes it looks clickable. */}
              <span className="inline-flex min-h-6 items-center gap-2">
                {app.askAmount ? <span className="tnum">Asking {formatMoney(app.askAmount)}</span> : null}
                {readOnly || isBid || app.mode === "essay" ? null : (
                <button
                  type="button"
                  onClick={() => setAskOpen(true)}
                  aria-label={app.askAmount ? "Change the ask" : undefined}
                  className="inline-flex min-h-6 items-center rounded-sm font-semibold text-ink underline-offset-4 hover:underline"
                >
                  {app.askAmount ? "Change" : "Set the ask"}
                </button>
                )}
              </span>
              {app.opportunity.deadline ? (
                <>
                  <span>Due {formatDate(app.opportunity.deadline, "MMM d")}</span>
                  <span className={cn(dl.tone === "danger" && "font-semibold text-alert")}>{dl.text}</span>
                </>
              ) : null}
              {owner ? <span>{owner.fullName}</span> : null}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-sm text-ink-muted sm:inline" aria-live="polite">
              {saved === "saving" ? "Saving" : saved === "saved" ? "Saved" : ""}
            </span>
            {readOnly ? (
              <StageBadge stage={app.stage} />
            ) : (
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
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  More <ChevronDown className="size-3" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {readOnly ? null : <DropdownMenuItem onSelect={planMilestones}>Plan milestones from the deadline</DropdownMenuItem>}
                <DropdownMenuItem asChild>
                  <Link href="/calendar">Open the calendar</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setPanel("checks");
                    setRightOpen(true);
                    void rerun();
                  }}
                >
                  Run checks again
                </DropdownMenuItem>
                {app.stage === "won" ? <DropdownMenuItem onSelect={() => setKitOpen(true)}>Grant-win kit</DropdownMenuItem> : null}
                {readOnly ? null : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setLogicOpen(true)}>Add a logic model</DropdownMenuItem>
                    {app.mode !== "proposal" ? <DropdownMenuItem onSelect={() => draftNow("proposal")}>Write the full proposal instead</DropdownMenuItem> : null}
                    {app.mode !== "letter" ? <DropdownMenuItem onSelect={() => draftNow("letter")}>Write a letter of inquiry instead</DropdownMenuItem> : null}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {app.stage === "won" ? (
              <Button variant="secondary" size="sm" onClick={() => setKitOpen(true)}>
                Grant-win kit
              </Button>
            ) : null}
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
          className={cn("hidden shrink-0 border-r border-rule bg-paper lg:block", leftOpen ? "w-56 xl:w-64" : "w-12")}
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
              <Checklist requirements={ws.requirements} sections={ws.sections} activeId={active?.id ?? ""} onSelect={setActiveId} note={isBid ? "Read from the solicitation. The full compliance matrix is on the bid page." : app.mode === "research" ? "The standard sections of a research proposal, and the funder's AI rule." : app.mode === "essay" ? "The sponsor's prompt, its word limit, and what to check before you send it." : app.mode === "letter" ? "What a letter of inquiry needs." : undefined} />
            </div>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-paper" aria-label="Editor">
          {active ? (
            <>
              <div className="flex flex-1 flex-col">
                <SectionEditor key={active.id} section={active} facts={ws.facts} onChange={onChange} onCitationClick={onCitationClick} onGapClick={onGapClick} onVersions={readOnly ? undefined : openVersions} readOnly={readOnly} />
              </div>
              <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-rule bg-paper px-5 py-3 sm:px-10">
                <p className="text-sm text-ink-muted">
                  {active.status === "approved" ? "You approved this section." : active.status === "needs_facts" ? "A few gaps here are waiting on your answers." : "Read it over, then approve it when it sounds like you."}
                </p>
                {active.status === "approved" ? (
                  <div className="flex items-center gap-4">
                    {justApproved === active.id ? <ApprovedMark grow className="fleeting -my-2 h-7 w-7 self-end" /> : null}
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

        <aside className={cn("border-t border-rule bg-paper lg:border-l lg:border-t-0", rightOpen ? "lg:w-72 xl:w-80" : "lg:w-12")} aria-label="Questions, checks, and sources">
          <div className="hidden items-center justify-between px-2 py-2 lg:flex">
            {rightOpen ? <span className="px-2 text-sm font-semibold text-ink">Review</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={rightOpen ? "Collapse review panel" : "Expand review panel"} aria-expanded={rightOpen} onClick={() => setRightOpen((o) => !o)}>
              <PanelRight />
            </Button>
          </div>
          <div className={cn("px-4 pb-8 lg:px-4", !rightOpen && "lg:hidden")}>
            <Tabs value={panel} onValueChange={(v) => setPanel(v as typeof panel)}>
              <TabsList variant="line" aria-label="Review panels" className="flex-wrap gap-x-4 gap-y-0 overflow-visible">
                <TabsTrigger value="questions">
                  Questions
                  {openQuestions ? <span className="count">{openQuestions}</span> : null}
                </TabsTrigger>
                <TabsTrigger value="checks">
                  Checks
                  {fails ? <span className="text-sm font-semibold text-alert tnum">{fails}</span> : null}
                </TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="reviewer">Reviewer</TabsTrigger>
                {isBid || app.mode === "essay" ? null : <TabsTrigger value="budget">Budget</TabsTrigger>}
              </TabsList>
              <TabsContent value="questions">
                {readOnly ? <p className="mb-3 text-sm text-ink-muted">The owner or an editor answers these.</p> : null}
                <fieldset disabled={readOnly} className="min-w-0">
                  <legend className="sr-only">Open questions</legend>
                  <QuestionsPanel questions={ws.missingFacts} sections={ws.sections} highlightId={highlightGap} onAnswer={answer} onSkip={skip} />
                </fieldset>
              </TabsContent>
              <TabsContent value="checks">
                <CompliancePanel checks={ws.complianceChecks} onRerun={rerun} running={checking} onJump={(id) => setActiveId(id)} />
              </TabsContent>
              <TabsContent value="sources">
                <SourcesPanel facts={ws.facts} documents={ws.documents} sections={ws.sections} highlightFactId={highlightFact} />
              </TabsContent>
              <TabsContent value="reviewer">
                <ReviewerPanel check={reviewer} onRun={runReviewer} running={panelBusy === "reviewer"} />
              </TabsContent>
              <TabsContent value="budget">
                {readOnly ? <p className="mb-3 text-sm text-ink-muted">Read only for board reviewers.</p> : null}
                <fieldset disabled={readOnly} className="min-w-0">
                  <legend className="sr-only">Budget</legend>
                  <BudgetPanel budget={budget} onSave={saveBudget} onJustify={justify} onAddSection={addBudgetSection} busy={panelBusy} />
                </fieldset>
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>

      <LogicModelDialog applicationId={app.id} open={logicOpen} onOpenChange={setLogicOpen} onAdded={afterLogicModel} />
      <WinKitDialog applicationId={app.id} open={kitOpen} onOpenChange={setKitOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} app={app} sections={ws.sections} orgName={orgName} />
      <VersionsDialog open={versionsOpen} onOpenChange={setVersionsOpen} versions={versions} onRestore={restore} loading={versionsLoading} />
      <Dialog open={!!job} onOpenChange={() => undefined}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{drafting === "letter" ? "Writing the letter of inquiry" : "Drafting the full proposal"}</DialogTitle>
            <DialogDescription>{drafting === "letter" ? "About half a minute." : "A minute or two."} The current sections are replaced when it finishes.</DialogDescription>
          </DialogHeader>
          {job ? <ProgressSteps job={job} /> : null}
        </DialogContent>
      </Dialog>
      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>How much are you asking for?</DialogTitle>
            <DialogDescription>Used as written in the draft and the budget. Leave it empty and the draft asks you instead of guessing.</DialogDescription>
          </DialogHeader>
          <Field id="ask" label="Ask amount" optional>
            <Input inputMode="numeric" className="tnum" value={askValue} onChange={(e) => setAskValue(e.target.value)} placeholder="40000" />
          </Field>
          <AskSuggestion applicationId={app.id} open={askOpen} onUse={(n) => setAskValue(String(n))} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsk}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
