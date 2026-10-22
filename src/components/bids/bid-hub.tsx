"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Member, Milestone, Section, Sf330 } from "@/lib/types";
import type { BidView } from "@/lib/services/contracts";
import { services } from "@/lib/services";
import { inBrowserDemo } from "@/lib/demo/flags";
import { PageContainer } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { newJobId, watchJob, finalJob, runLong } from "@/lib/progress-client";
import { stageLabel, MODE_LABELS } from "@/lib/segments";
import { milestoneMeta } from "@/lib/agents/meta";
import { feeTotals, lineTotal } from "@/lib/bids/fee";
import { SECTION_TITLES } from "@/lib/bids/matrix";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const DRAFT_STEPS: JobView = { status: "running", steps: [{ label: "Choosing projects and people from your records", state: "active" }, { label: "Writing the sections", state: "pending" }, { label: "Checking every citation and number", state: "pending" }, { label: "Updating the compliance matrix", state: "pending" }] };

const STATUS: Record<string, { label: string; className: string }> = {
  met: { label: "Met", className: "bg-panel-sage text-meadow" },
  partial: { label: "Partly", className: "bg-panel-cream text-ink" },
  open: { label: "Open", className: "border border-alert text-alert" },
  firm_action: { label: "Your step", className: "bg-panel-mist text-ink" },
  not_applicable: { label: "Does not apply", className: "bg-panel-mist text-ink-muted" },
};

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const when = (iso: string) => `${formatDate(iso.slice(0, 10))}${iso.length > 10 ? ` at ${iso.slice(11, 16)}` : ""}`;

export function BidHub({ initial, sf330: initialSf, sections, milestones, demo, role }: { initial: BidView; sf330: Sf330 | null; sections: Section[]; milestones: Milestone[]; demo: boolean; role: Member["role"] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [bid, setBid] = React.useState(initial);
  const [sf, setSf] = React.useState(initialSf);
  const [tab, setTab] = React.useState("decide");
  const [job, setJob] = React.useState<JobView | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState(initial.goNoGo?.note ?? "");
  const [filter, setFilter] = React.useState<"all" | "open" | "firm_action" | "met">("all");
  const [openReq, setOpenReq] = React.useState<string | null>(null);
  const [addText, setAddText] = React.useState("");
  const readOnly = role === "reviewer";
  const app = bid.application;
  const sol = bid.solicitation;
  const g = bid.goNoGo;
  const sectionTitle = (id: string | null | undefined) => sections.find((s) => s.id === id)?.title ?? null;

  const reload = async () => {
    const next = await services.bids.get(app.id);
    if (next) setBid(next);
    setSf(await services.bids.sf330(app.id));
    router.refresh();
  };
  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      await reload();
      if (done) toast({ title: done });
    } catch (err) {
      toast({ title: "That did not work", description: err instanceof Error ? err.message : undefined, tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  const draft = async () => {
    const jobId = newJobId();
    setJob(DRAFT_STEPS);
    const stop = watchJob(jobId, setJob);
    const r = await runLong(jobId, "bids.draft", [app.id, jobId], () => services.bids.draft(app.id, jobId));
    stop();
    if (!r.ok) {
      setJob(null);
      toast({ title: "We could not draft the proposal", description: r.error, tone: "warning" });
      return;
    }
    setJob(await finalJob(jobId, DRAFT_STEPS));
    await reload();
    toast({ title: "Proposal drafted", description: `${r.data.wordCount} words. ${r.data.met} of ${r.data.total} requirements met.${r.data.openQuestions ? ` ${r.data.openQuestions} questions for you.` : ""}` });
  };

  const people = (id: string | null) => bid.personnel.find((p) => p.id === id);
  const reqs = bid.requirements.filter((r) => filter === "all" || (filter === "met" ? r.matrixStatus === "met" : filter === "open" ? r.matrixStatus === "open" || r.matrixStatus === "partial" : r.matrixStatus === filter));

  return (
    <PageContainer width="wide">
      <Link href="/pipeline" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        Pipeline
      </Link>
      <header className="mt-4 border-b border-rule pb-6">
        <p className="text-base text-ink-muted">
          {app.funder.name}
          {sol.number ? ` · ${sol.number}` : ""} · {MODE_LABELS[app.mode]}
        </p>
        <h1 className="mt-1 font-display text-h1 text-ink">{app.opportunity.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-ink-muted">
          <span className="font-semibold text-ink">{stageLabel(app.stage, "contract")}</span>
          {app.opportunity.deadline ? <span>Due {formatDate(app.opportunity.deadline)}</span> : <span>No due date found</span>}
          {sol.setAside ? <span>{sol.setAside}</span> : <span>No set-aside</span>}
          <span>
            Matrix: {bid.matrix.met} of {bid.matrix.total} met
          </span>
          {sections.length ? (
            <Link href={`/applications/${app.id}/draft`} className="font-semibold text-ink underline underline-offset-4">
              Open the draft
            </Link>
          ) : null}
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList variant="pill" aria-label="Bid" className="flex-wrap">
          <TabsTrigger value="decide">Go/no-go</TabsTrigger>
          <TabsTrigger value="matrix">
            Compliance matrix <span className="text-sm text-ink-muted tnum">{bid.requirements.length}</span>
          </TabsTrigger>
          <TabsTrigger value="team">Team and projects</TabsTrigger>
          <TabsTrigger value="fee">Fee</TabsTrigger>
          <TabsTrigger value="addenda">
            Addenda <span className="text-sm text-ink-muted tnum">{bid.addenda.length}</span>
          </TabsTrigger>
          {app.mode === "sf330" || sol.forms.includes("SF 330") ? <TabsTrigger value="sf330">SF 330</TabsTrigger> : null}
          <TabsTrigger value="dates">Dates</TabsTrigger>
        </TabsList>

        {/* ---------- Go/no-go ---------- */}
        <TabsContent value="decide" className="mt-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_20rem] [&>*]:min-w-0">
            <section aria-labelledby="gng">
              <div className="flex flex-wrap items-end gap-6">
                <p className="font-display text-[5.5rem] leading-[0.85] text-ink tnum" aria-label={`Go/no-go score ${g?.score ?? 0} of 100`}>
                  {g?.score ?? "–"}
                </p>
                <div className="pb-1">
                  <h2 id="gng" className="font-display text-2xl text-ink">
                    {g?.suggestion === "go" ? "Worth pursuing" : g?.suggestion === "review" ? "A judgment call" : "Probably not worth it"}
                  </h2>
                  <p className="text-base text-ink-muted">Scored from your records and the solicitation. The decision is yours.</p>
                </div>
              </div>
              {g?.stoppers.length ? (
                <div className="mt-6 border-l-[6px] border-alert py-1 pl-4">
                  <p className="font-semibold text-ink">Stops the bid</p>
                  <ul className="mt-1 text-base text-ink">
                    {g.stoppers.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="mt-8 border-t border-rule">
                {(g?.factors ?? []).map((f) => (
                  <li key={f.key} className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[13rem_1fr]">
                    <div>
                      <p className="font-semibold text-ink">{f.label}</p>
                      <div className="mt-2 h-2 w-full max-w-[10rem] rounded-full bg-panel-sage" aria-hidden>
                        <div className={cn("h-2 rounded-full", f.score >= 0.7 ? "bg-meadow" : f.score >= 0.4 ? "bg-meadow-light" : "bg-alert")} style={{ width: `${Math.round(f.score * 100)}%` }} />
                      </div>
                      <p className="sr-only">{Math.round(f.score * 100)} out of 100</p>
                    </div>
                    <p className="text-base text-ink">{f.detail}</p>
                  </li>
                ))}
              </ul>
              {!readOnly ? (
                <div className="mt-8">
                  <Field id="gng-note" label="Note for the team (optional)">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  </Field>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={() => act("go", () => services.bids.decide(app.id, "go", note || null), "Marked as go")} loading={busy === "go"} disabled={Boolean(busy)}>
                      Go
                    </Button>
                    <Button variant="secondary" onClick={() => act("no", () => services.bids.decide(app.id, "no_go", note || null), "Marked as no-go")} loading={busy === "no"} disabled={Boolean(busy)}>
                      No-go
                    </Button>
                    <Button variant="ghost" onClick={() => act("rescore", () => services.bids.rescore(app.id), "Scored again from your current records")} loading={busy === "rescore"} disabled={Boolean(busy)}>
                      Score again
                    </Button>
                    {g?.decision ? (
                      <span className="text-base text-ink-muted">
                        Decided {g.decision === "go" ? "go" : "no-go"} by {g.decidedBy} on {formatDate(g.decidedAt ?? "")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-12 border-t border-rule pt-6">
                <h2 className="font-display text-2xl text-ink">{sections.length ? "The draft" : "Draft the proposal"}</h2>
                <p className="mt-2 max-w-[65ch] text-base text-ink-muted">
                  {demo && bid.readBy === "rules"
                    ? "The projects, people, references, schedule, and quality sections are built from your records. Without a model key, the cover letter and approach start as an outline of what the solicitation asks, for you to write."
                    : "Projects, people, references, schedule, and quality come straight from your records. The cover letter, qualifications, and approach are written from them. Every claim cites a record, and anything missing becomes a question. Pricing stays with you."}
                </p>
                {!readOnly ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={draft} loading={job?.status === "running"} disabled={job?.status === "running"}>
                      {sections.length ? "Draft again" : "Draft the proposal"}
                    </Button>
                    {sections.length ? (
                      <Button asChild variant="secondary">
                        <Link href={`/applications/${app.id}/draft`}>Open the draft</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {job ? (
                  <div className="mt-6 max-w-2xl" aria-live="polite">
                    <ProgressSteps job={job} />
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="border-l-[3px] border-rule-strong pl-5 text-base lg:self-start">
              <h2 className="font-display text-xl text-ink">The solicitation</h2>
              <dl className="mt-3 flex flex-col gap-3">
                {[
                  ["Type", sol.type === "SF330" ? "Architect-engineer qualifications (SF 330)" : sol.type === "sources_sought" ? "Sources sought" : sol.type],
                  ["NAICS", sol.naics.join(", ") || "Not stated"],
                  ["Set-aside", sol.setAside ?? "None"],
                  ["Place of performance", sol.placeOfPerformance ?? "Not stated"],
                  ["Estimated value", sol.estimatedValue?.max ? usd(sol.estimatedValue.max) : "Not stated"],
                  ["Forms", sol.forms.join(", ") || "None named"],
                  ["Contact", sol.contact ? [sol.contact.name, sol.contact.email, sol.contact.phone].filter(Boolean).join(", ") : "Not stated"],
                  ["Read by", bid.readBy === "rules" ? `Rules, from ${bid.pageCount} page${bid.pageCount === 1 ? "" : "s"}` : `Rules and the model, from ${bid.pageCount} page${bid.pageCount === 1 ? "" : "s"}`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm text-ink-muted">{k}</dt>
                    <dd className="text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {sol.evaluation.length ? (
                <>
                  <h3 className="mt-6 font-semibold text-ink">How it is evaluated</h3>
                  <ol className="mt-2 list-decimal pl-5 text-ink">
                    {sol.evaluation.map((e) => (
                      <li key={e.factor}>
                        {e.factor}
                        {e.weight ? <span className="text-ink-muted">, {e.weight}</span> : null}
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              {sol.pageLimits.length ? (
                <>
                  <h3 className="mt-6 font-semibold text-ink">Page limits</h3>
                  <p className="mt-1 text-ink">{sol.pageLimits[0]}</p>
                </>
              ) : null}
              {app.opportunity.sourceUrl ? (
                <a href={app.opportunity.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block text-ink underline underline-offset-4">
                  Read the original<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </aside>
          </div>
        </TabsContent>

        {/* ---------- Compliance matrix ---------- */}
        <TabsContent value="matrix" className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[65ch] text-base text-ink-muted">
              Every requirement we found, the sentence it comes from, where your proposal answers it, and whether it is done. {bid.matrix.met} met, {bid.matrix.partial} partly, {bid.matrix.open} open, {bid.matrix.firmAction} for you to handle when you assemble the package.
            </p>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList variant="pill" aria-label="Filter the matrix">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="firm_action">Your steps</TabsTrigger>
                <TabsTrigger value="met">Met</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-t border-ink text-left text-base">
              <thead>
                <tr className="border-b border-rule text-sm text-ink-muted">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Requirement
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Where it is set
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Answered in
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {reqs.map((r) => {
                  const st = STATUS[r.matrixStatus ?? "open"];
                  const expanded = openReq === r.id;
                  return (
                    <tr key={r.id} className="border-b border-rule align-top">
                      <td className="py-3 pr-4">
                        <button type="button" onClick={() => setOpenReq(expanded ? null : r.id)} aria-expanded={expanded} className="text-left font-semibold text-ink underline-offset-4 hover:underline">
                          {r.title}
                        </button>
                        {r.required ? null : <span className="ml-2 text-sm text-ink-muted">optional</span>}
                        {expanded ? <blockquote className="mt-2 border-l-2 border-rule-strong pl-3 text-sm text-ink-muted">&ldquo;{r.excerpt ?? r.detail}&rdquo;</blockquote> : null}
                      </td>
                      <td className="py-3 pr-4 text-sm text-ink-muted">{r.ref}</td>
                      <td className="py-3 pr-4 text-sm">
                        {r.answeredInSectionId ? (
                          <Link href={`/applications/${app.id}/draft?section=${r.answeredInSectionId}`} className="text-ink underline underline-offset-4">
                            {sectionTitle(r.answeredInSectionId)}
                          </Link>
                        ) : (
                          <span className="text-ink-muted">{SECTION_TITLES[r.sectionKey ?? ""] ?? "Not yet"}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold", st.className)}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!readOnly ? (
            <Button variant="secondary" className="mt-5" onClick={() => act("matrix", () => services.bids.refreshMatrix(app.id), "Matrix checked against the current draft")} loading={busy === "matrix"}>
              Check the matrix again
            </Button>
          ) : null}
        </TabsContent>

        {/* ---------- Team and projects ---------- */}
        <TabsContent value="team" className="mt-8">
          <TeamPanel bid={bid} readOnly={readOnly} onSaved={reload} people={people} />
        </TabsContent>

        {/* ---------- Fee ---------- */}
        <TabsContent value="fee" className="mt-8">
          {bid.fee ? <FeePanel bid={bid} readOnly={readOnly} onSaved={reload} /> : <p className="text-base text-ink-muted">The fee structure appears with the first draft. Draft the proposal on the Go/no-go tab.</p>}
        </TabsContent>

        {/* ---------- Addenda ---------- */}
        <TabsContent value="addenda" className="mt-8">
          <p className="max-w-[65ch] text-base text-ink-muted">Each addendum, what it changed, and whether your proposal acknowledges it. A new due date moves the deadline and replans the calendar.</p>
          {bid.addenda.length ? (
            <ul className="mt-6 border-t border-rule">
              {bid.addenda.map((a) => (
                <li key={a.id} className="border-b border-rule py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-display text-xl text-ink">Addendum {a.number}</h3>
                    {!readOnly ? (
                      <label className="flex items-center gap-2 text-base text-ink">
                        <Checkbox checked={a.acknowledged} onCheckedChange={(c) => act(`ack_${a.id}`, () => services.bids.acknowledgeAddendum(a.id, c === true))} />
                        Acknowledged in the proposal
                      </label>
                    ) : null}
                  </div>
                  <p className="mt-1 text-base text-ink">{a.summary}</p>
                  {a.changes.length ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {a.changes.slice(0, 8).map((c, i) => (
                        <li key={i} className="text-base">
                          <span className="mr-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{c.kind === "answer" ? "Q&A" : c.kind}</span>
                          <span className="text-ink">{c.text.length > 240 ? `${c.text.slice(0, 238)}…` : c.text}</span>
                          {c.after && c.kind !== "answer" ? <span className="text-ink-muted"> Now: {c.after}</span> : null}
                          {c.kind === "answer" && c.after ? <span className="block pl-10 text-ink-muted">{c.after.length > 240 ? `${c.after.slice(0, 238)}…` : c.after}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-base text-ink-muted">No addenda yet.</p>
          )}
          {!readOnly ? (
            <div className="mt-8 max-w-2xl">
              <Field id="addendum-text" label="Paste an addendum">
                <Textarea value={addText} onChange={(e) => setAddText(e.target.value)} rows={5} />
              </Field>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    act("addendum", async () => {
                      const r = await services.bids.addAddendum(app.id, { text: addText });
                      if (!r.ok) throw new Error(r.error);
                      setAddText("");
                    }, "Addendum read")
                  }
                  loading={busy === "addendum"}
                  disabled={!addText.trim()}
                >
                  Read the addendum
                </Button>
                {demo && sol.number === "36C25723R0049" ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act("addendum_s", async () => {
                        const r = await services.bids.addAddendum(app.id, { sample: true });
                        if (!r.ok) throw new Error(r.error);
                      }, "Amendment added from the notice")
                    }
                    loading={busy === "addendum_s"}
                  >
                    Add the notice&apos;s next amendment
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ---------- SF 330 ---------- */}
        <TabsContent value="sf330" className="mt-8">
          {sf ? <Sf330Preview sf={sf} appId={app.id} /> : null}
        </TabsContent>

        {/* ---------- Dates ---------- */}
        <TabsContent value="dates" className="mt-8">
          <div className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
            <section>
              <h2 className="font-display text-2xl text-ink">Dates in the solicitation</h2>
              {sol.dates.length ? (
                <ul className="mt-4 border-t border-rule">
                  {sol.dates.map((d) => (
                    <li key={`${d.kind}${d.date}`} className="border-b border-rule py-3">
                      <p className="font-semibold text-ink">
                        {d.label}
                        {d.mandatory ? <span className="ml-2 text-sm text-alert">mandatory</span> : null}
                      </p>
                      <p className="text-base text-ink">{when(d.date)}</p>
                      {d.ref ? <p className="text-sm text-ink-muted">{d.ref}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-base text-ink-muted">We found no dates other than the due date.</p>
              )}
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink">Your plan, working back</h2>
              <ul className="mt-4 border-t border-rule">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <span className="text-ink">
                      {m.title}
                      <span className="ml-2 text-sm text-ink-muted">{milestoneMeta[m.kind]?.label}</span>
                    </span>
                    <span className="shrink-0 text-base text-ink tnum">{formatDate(m.dueDate)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/calendar" className="mt-4 inline-block text-ink underline underline-offset-4">
                See the calendar
              </Link>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function TeamPanel({ bid, readOnly, onSaved, people }: { bid: BidView; readOnly: boolean; onSaved: () => Promise<void>; people: (id: string | null) => BidView["personnel"][number] | undefined }) {
  const { toast } = useToast();
  const [projectIds, setProjectIds] = React.useState<string[]>(bid.meta?.projectIds ?? []);
  const [assignments, setAssignments] = React.useState(bid.meta?.assignments ?? []);
  const [info, setInfo] = React.useState(bid.meta?.additionalInformation ?? "");
  const [saving, setSaving] = React.useState(false);
  const sf330 = bid.application.mode === "sf330";
  const limit = sf330 ? 10 : 5;
  const save = async () => {
    setSaving(true);
    await services.bids.setSelection(bid.application.id, { projectIds, assignments, additionalInformation: info });
    await onSaved();
    setSaving(false);
    toast({ title: "Team and projects saved", description: "Draft again to use them." });
  };
  return (
    <div className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
      <section>
        <h2 className="font-display text-2xl text-ink">Projects to show</h2>
        <p className="mt-1 text-base text-ink-muted">Chosen from your portfolio for this solicitation. {sf330 ? "Section F holds up to 10." : `Up to ${limit} is usual.`}</p>
        <ul className="mt-4 border-t border-rule">
          {bid.projects.map((p) => {
            const on = projectIds.includes(p.id);
            return (
              <li key={p.id} className="flex items-start gap-3 border-b border-rule py-3">
                <Checkbox id={`proj-${p.id}`} checked={on} disabled={readOnly || (!on && projectIds.length >= limit)} onCheckedChange={(c) => setProjectIds((xs) => (c === true ? [...xs, p.id] : xs.filter((x) => x !== p.id)))} className="mt-1" />
                <label htmlFor={`proj-${p.id}`} className="min-w-0 cursor-pointer">
                  <span className="block font-semibold text-ink">{p.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {p.client}, {[p.city, p.state].filter(Boolean).join(", ")}
                    {p.completionDate ? `, ${p.completionDate.slice(0, 4)}` : p.status === "in_progress" ? ", in progress" : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl text-ink">People for each role</h2>
        <p className="mt-1 text-base text-ink-muted">Roles the solicitation names, then the roles a team like this usually shows.</p>
        <ul className="mt-4 border-t border-rule">
          {assignments.map((a, i) => (
            <li key={a.role} className="grid gap-2 border-b border-rule py-3 sm:grid-cols-[11rem_1fr] sm:items-center">
              <label htmlFor={`role-${i}`} className="font-semibold text-ink">
                {a.role}
              </label>
              <Select value={a.personnelId ?? "none"} disabled={readOnly} onValueChange={(v) => setAssignments((xs) => xs.map((x, j) => (j === i ? { ...x, personnelId: v === "none" ? null : v, why: v === "none" ? "No one is assigned." : `${people(v)?.name}, ${people(v)?.title}.` } : x)))}>
                <SelectTrigger id={`role-${i}`} className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No one yet</SelectItem>
                  {bid.personnel.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}, {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
        {sf330 ? (
          <div className="mt-6">
            <Field id="sf330-h" label="SF 330 Section H: additional information">
              <Textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={5} disabled={readOnly} />
            </Field>
          </div>
        ) : null}
      </section>
      {!readOnly ? (
        <div className="lg:col-span-2">
          <Button onClick={save} loading={saving}>
            Save team and projects
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FeePanel({ bid, readOnly, onSaved }: { bid: BidView; readOnly: boolean; onSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const [fee, setFee] = React.useState(bid.fee!);
  const [saving, setSaving] = React.useState(false);
  const totals = feeTotals(fee);
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^0-9.]/g, "")) || null);
  const setLine = (phase: number, line: number, patch: Partial<(typeof fee.phases)[number]["lines"][number]>) => setFee((f) => ({ ...f, phases: f.phases.map((p, i) => (i !== phase ? p : { ...p, lines: p.lines.map((l, j) => (j === line ? { ...l, ...patch } : l)) })) }));
  const save = async () => {
    setSaving(true);
    await services.bids.saveFee(bid.application.id, fee);
    await onSaved();
    setSaving(false);
    toast({ title: "Fee saved" });
  };
  return (
    <div>
      <p className="max-w-[65ch] text-base text-ink-muted">The structure is ours; every number is yours. We never make up hours, rates, or prices. The only numbers filled in are the hourly rates from your own records, for you to change.</p>
      {fee.instructions.length ? (
        <div className="mt-5 border-l-[3px] border-rule-strong pl-4">
          <p className="font-semibold text-ink">What the solicitation says about price</p>
          <ul className="mt-1 flex flex-col gap-1 text-base text-ink">
            {fee.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-t border-ink text-left text-base">
          <thead>
            <tr className="border-b border-rule text-sm text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Phase and role
              </th>
              <th scope="col" className="w-24 py-2 pr-3 font-semibold">
                Hours
              </th>
              <th scope="col" className="w-28 py-2 pr-3 font-semibold">
                Rate
              </th>
              <th scope="col" className="w-32 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {fee.phases.map((ph, i) => (
              <React.Fragment key={ph.key}>
                <tr className="border-b border-rule bg-panel-sage/50">
                  <th scope="rowgroup" colSpan={3} className="py-2 pr-3 font-semibold text-ink">
                    {ph.name}
                  </th>
                  <td className="py-2 text-right text-ink tnum">{totals.phases[i].total ? usd(totals.phases[i].total) : "–"}</td>
                </tr>
                {ph.lines.map((l, j) => (
                  <tr key={l.id} className="border-b border-rule">
                    <td className="py-2 pr-3 text-ink">{l.label}</td>
                    <td className="py-2 pr-3">
                      <Input aria-label={`Hours for ${l.label}, ${ph.name}`} className="h-9" inputMode="decimal" disabled={readOnly} value={l.hours ?? ""} onChange={(e) => setLine(i, j, { hours: num(e.target.value) })} />
                    </td>
                    <td className="py-2 pr-3">
                      <Input aria-label={`Rate for ${l.label}, ${ph.name}`} className="h-9" inputMode="decimal" disabled={readOnly} value={l.rate ?? ""} onChange={(e) => setLine(i, j, { rate: num(e.target.value) })} />
                    </td>
                    <td className="py-2 text-right text-ink tnum">{lineTotal(l) != null ? usd(lineTotal(l)!) : <span className="text-ink-muted">blank</span>}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="py-3 pr-3 font-display text-xl text-ink">
                Total from your numbers
              </th>
              <td className="py-3 text-right font-display text-xl text-ink tnum">{usd(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {totals.blank ? <p className="mt-2 text-sm text-ink-muted">{totals.blank} line{totals.blank === 1 ? " is" : "s are"} still blank.</p> : null}
      {!readOnly ? (
        <Button className="mt-5" onClick={save} loading={saving}>
          Save the fee
        </Button>
      ) : null}
    </div>
  );
}

/** The browser demo builds the Word file here, from the bid as this browser has it. */
async function downloadSf330(appId: string) {
  const sf = await services.bids.sf330(appId);
  if (!sf) return;
  const { sf330Blob, sf330FileName } = await import("@/lib/bids/sf330-docx");
  const url = URL.createObjectURL(await sf330Blob(sf));
  const a = document.createElement("a");
  a.href = url;
  a.download = sf330FileName(sf);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Sf330Preview({ sf, appId }: { sf: Sf330; appId: string }) {
  const a = sf.partI;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem] [&>*]:min-w-0">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={`/api/bids/${appId}/sf330`} download onClick={(e) => inBrowserDemo() && (e.preventDefault(), void downloadSf330(appId))}>
              Download the SF 330 (Word)
            </a>
          </Button>
          <p className="text-sm text-ink-muted">A working copy in the form&apos;s numbering, to check and move into the official GSA form.</p>
        </div>
        <h2 className="mt-8 font-display text-2xl text-ink">Part I. Contract-specific qualifications</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">A. Contract</dt>
            <dd className="text-ink">
              {a.a.title}
              {a.a.number ? `, ${a.a.number}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">B. Point of contact</dt>
            <dd className="text-ink">{a.b ? `${a.b.name}, ${a.b.firm}` : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">C. Proposed team</dt>
            <dd className="text-ink">{a.c.map((c) => `${c.firm} (${c.role})`).join("; ")}</dd>
          </div>
        </dl>
        <h3 className="mt-8 font-display text-xl text-ink">E. Résumés ({a.e.length})</h3>
        <ul className="mt-3 border-t border-rule">
          {a.e.map((r) => (
            <li key={r.personnelId + r.role} className="border-b border-rule py-3">
              <p className="font-semibold text-ink">
                {r.name} <span className="font-normal text-ink-muted">· {r.role}</span>
              </p>
              <p className="text-sm text-ink-muted">
                {r.yearsTotal ?? "?"} years, {r.yearsWithFirm ?? "?"} with the firm · {r.registrations.join("; ") || "No registrations listed"}
              </p>
              <p className="mt-1 text-sm text-ink">{r.projects.map((x) => x.title).join("; ")}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 font-display text-xl text-ink">F. Example projects ({a.f.length} of 10)</h3>
        <ol className="mt-3 border-t border-rule">
          {a.f.map((f) => (
            <li key={f.key} className="border-b border-rule py-3">
              <p className="font-semibold text-ink">
                {f.key}. {f.title}
              </p>
              <p className="text-sm text-ink-muted">
                {f.location} · {f.owner}
                {f.completed.construction ? ` · completed ${f.completed.construction}` : ""}
              </p>
            </li>
          ))}
        </ol>
        <h3 className="mt-8 font-display text-xl text-ink">G. Who worked on which example project</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[30rem] border-t border-ink text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Name and role
                </th>
                {a.g.projects.map((p) => (
                  <th key={p.key} scope="col" className="w-8 py-2 text-center font-semibold" title={p.title}>
                    {p.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.g.people.map((p) => (
                <tr key={p.name + p.role} className="border-b border-rule">
                  <th scope="row" className="py-2 pr-3 font-normal text-ink">
                    {p.name}, {p.role}
                  </th>
                  {a.g.projects.map((pp) => (
                    <td key={pp.key} className="py-2 text-center text-ink">
                      {p.marks.includes(pp.key) ? <span aria-label="Worked on this project">●</span> : <span className="sr-only">No</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="mt-10 font-display text-2xl text-ink">Part II. General qualifications</h2>
        <p className="mt-2 text-base text-ink">
          {sf.partII.firmName}, established {sf.partII.yearEstablished ?? "?"}, UEI {sf.partII.uei ?? "not set"}. {sf.partII.smallBusinessStatus ?? ""}
        </p>
        <p className="mt-1 text-sm text-ink-muted">{sf.partII.disciplines.map((d) => `${d.count} ${d.discipline}`).join(", ")}</p>
      </div>
      <aside className="border-l-[3px] border-rule-strong pl-5 lg:self-start">
        <h2 className="font-display text-xl text-ink">Still to supply</h2>
        {sf.missing.length ? (
          <ul className="mt-3 flex flex-col gap-2 text-base text-ink">
            {sf.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base text-ink-muted">Nothing. Check it and sign the official form.</p>
        )}
      </aside>
    </div>
  );
}
