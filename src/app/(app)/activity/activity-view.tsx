"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { AgentName, AgentRun, Document } from "@/lib/types";
import { agentMeta } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

/** The status of a run, said in a word. Ink for done and neutral, bold while it runs, red when it failed. */
const statusWord: Record<AgentRun["status"], { label: string; className: string }> = {
  queued: { label: "Queued", className: "text-ink-muted" },
  running: { label: "Running now", className: "font-semibold text-ink" },
  succeeded: { label: "Done", className: "text-ink-muted" },
  failed: { label: "Failed", className: "font-semibold text-alert" },
};

const triggerText: Record<AgentRun["trigger"], string> = {
  schedule: "Scheduled",
  user: "You asked",
  event: "After an upload or change",
};

export function ActivityView({ runs, documents }: { runs: AgentRun[]; documents: Document[] }) {
  const [agent, setAgent] = React.useState<AgentName | "all">("all");
  const [open, setOpen] = React.useState<string | null>(runs[0]?.id ?? null);
  const list = agent === "all" ? runs : runs.filter((r) => r.agent === agent);
  const cost = runs.reduce((s, r) => s + r.costUsd, 0);
  const docTitle = (id: string | null) => documents.find((d) => d.id === id)?.title;

  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        description={
          <>
            Everything we did on your behalf, step by step, with every source we read. <span className="tnum">{runs.length}</span> runs this month. About <span className="tnum">${cost.toFixed(2)}</span> in model costs.
          </>
        }
      />
      <Tabs value={agent} onValueChange={(v) => setAgent(v as typeof agent)} className="mt-6">
        <TabsList variant="pill" aria-label="Filter by agent">
          <TabsTrigger value="all">All</TabsTrigger>
          {(Object.keys(agentMeta) as AgentName[]).map((a) => (
            <TabsTrigger key={a} value={a}>
              {agentMeta[a].shortLabel}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {list.length === 0 ? (
        <EmptyState className="mt-6" title="Nothing here yet" description="Nothing has run for you under this filter yet." />
      ) : (
        <ol className="mt-6 border-t border-rule">
          {list.map((run) => {
            const expanded = open === run.id;
            const s = statusWord[run.status];
            const duration = run.finishedAt ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000) : null;
            return (
              <li key={run.id} className="border-b border-rule">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`run-${run.id}`}
                  onClick={() => setOpen(expanded ? null : run.id)}
                  className="flex w-full items-start gap-4 py-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span className="font-semibold text-ink">{agentMeta[run.agent].label}</span>
                      <time dateTime={run.startedAt} title={formatDate(run.startedAt, "MMM d, yyyy h:mm a")}>
                        {relativeTime(run.startedAt)}
                      </time>
                      <span>{triggerText[run.trigger]}</span>
                    </p>
                    <h2 className="mt-1.5 font-display text-xl text-ink">{run.title}</h2>
                    <p className="mt-1 max-w-[65ch] text-base text-ink-muted">{run.outputSummary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pt-0.5 text-sm">
                    <span className={s.className}>{s.label}</span>
                    <ChevronDown className={cn("size-4 text-ink transition-transform", expanded && "rotate-180")} aria-hidden />
                  </div>
                </button>
                {expanded ? (
                  <div id={`run-${run.id}`} className="grid gap-8 border-t border-rule py-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Steps</h3>
                      <ol className="mt-2 border-t border-rule">
                        {run.toolsCalled.map((t, i) => (
                          <li key={i} className="flex items-baseline gap-4 border-b border-rule py-2 text-sm">
                            <span className="min-w-0 flex-1 text-ink">{t.summary}</span>
                            <span className="shrink-0 text-ink-muted tnum">{t.durationMs >= 1000 ? `${(t.durationMs / 1000).toFixed(1)}s` : `${t.durationMs}ms`}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Sources read</h3>
                      {run.sourcesUsed.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-muted">We did not need to read anything for this one.</p>
                      ) : (
                        <ul className="mt-2 border-t border-rule">
                          {run.sourcesUsed.map((src, i) => (
                            <li key={i} className="border-b border-rule py-2 text-sm">
                              {src.url ? (
                                <a href={src.url} target="_blank" rel="noreferrer" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
                                  {src.label}
                                </a>
                              ) : src.documentId ? (
                                <Link href="/profile?tab=documents" className="text-ink underline decoration-[1px] underline-offset-2 hover:decoration-ink">
                                  {docTitle(src.documentId) ?? src.label}
                                </Link>
                              ) : (
                                <span className="text-ink">{src.label}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <dt className="text-ink-muted">Cost</dt>
                          <dd className="font-semibold text-ink tnum">${run.costUsd.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Took</dt>
                          <dd className="font-semibold text-ink tnum">{duration == null ? "Still running" : `${duration}s`}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Result</dt>
                          <dd className="font-semibold text-ink">
                            {run.inboxItemId ? (
                              <Link href="/inbox" className="underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
                                In your Inbox
                              </Link>
                            ) : (
                              "Nothing for you to do"
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </PageContainer>
  );
}
