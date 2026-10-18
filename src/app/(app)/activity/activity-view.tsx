"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Database, ExternalLink, FileText, Globe } from "lucide-react";
import type { AgentName, AgentRun, Document } from "@/lib/types";
import { agentMeta } from "@/lib/agents/meta";
import { cn } from "@/lib/utils";
import { formatDate, relativeTime } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { AgentMark } from "@/components/app/badges";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";

const statusBadge: Record<AgentRun["status"], { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  succeeded: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
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
        description={`Everything we did on your behalf, step by step, with every source we read. ${runs.length} runs this month, about $${cost.toFixed(2)} in model costs.`}
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
        <EmptyState className="mt-6" title="Nothing here yet" description="This agent hasn't had a reason to run for you yet." />
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {list.map((run) => {
            const expanded = open === run.id;
            const s = statusBadge[run.status];
            const duration = run.finishedAt ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000) : null;
            return (
              <li key={run.id} className="rounded-lg border border-border bg-surface">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`run-${run.id}`}
                  onClick={() => setOpen(expanded ? null : run.id)}
                  className="flex w-full items-start gap-4 p-4 text-left sm:p-5"
                >
                  <AgentMark agent={run.agent} className={cn(run.status === "running" && "animate-pulse")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                      <span className="font-medium text-fg-muted">{agentMeta[run.agent].label}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={run.startedAt} title={formatDate(run.startedAt, "MMM d, yyyy h:mm a")}>{relativeTime(run.startedAt)}</time>
                      <span aria-hidden>·</span>
                      <span>{run.trigger === "schedule" ? "Scheduled" : run.trigger === "user" ? "You asked" : "Triggered by an upload or change"}</span>
                    </p>
                    <h2 className="mt-1 font-display text-lg leading-snug text-fg">{run.title}</h2>
                    <p className="mt-0.5 text-sm text-fg-muted">{run.outputSummary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={s.tone}>{s.label}</Badge>
                    <ChevronDown className={cn("size-4 text-fg-subtle transition-transform", expanded && "rotate-180")} aria-hidden />
                  </div>
                </button>
                {expanded ? (
                  <div id={`run-${run.id}`} className="grid gap-6 border-t border-border p-4 sm:p-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Tools called</h3>
                      <ol className="mt-2 flex flex-col gap-1.5">
                        {run.toolsCalled.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <code className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-fg">{t.name}</code>
                            <span className="min-w-0 flex-1 text-fg-muted">{t.summary}</span>
                            <span className="shrink-0 text-xs text-fg-subtle tnum">{t.durationMs >= 1000 ? `${(t.durationMs / 1000).toFixed(1)}s` : `${t.durationMs}ms`}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sources used</h3>
                      {run.sourcesUsed.length === 0 ? (
                        <p className="mt-2 text-sm text-fg-subtle">We didn't need to read anything for this one.</p>
                      ) : (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {run.sourcesUsed.map((src, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-fg-subtle" aria-hidden>
                                {src.kind === "web" ? <Globe className="size-3.5" /> : src.kind === "document" ? <FileText className="size-3.5" /> : <Database className="size-3.5" />}
                              </span>
                              {src.url ? (
                                <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-fg underline-offset-2 hover:underline">
                                  <span className="truncate">{src.label}</span> <ExternalLink className="size-3 shrink-0 text-fg-subtle" aria-hidden />
                                </a>
                              ) : src.documentId ? (
                                <Link href="/profile?tab=documents" className="truncate text-fg underline-offset-2 hover:underline">
                                  {docTitle(src.documentId) ?? src.label}
                                </Link>
                              ) : (
                                <span className="text-fg">{src.label}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-fg-subtle">Cost</dt>
                          <dd className="font-medium text-fg tnum">${run.costUsd.toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-fg-subtle">Duration</dt>
                          <dd className="font-medium text-fg tnum">{duration == null ? "Running" : `${duration}s`}</dd>
                        </div>
                        <div>
                          <dt className="text-fg-subtle">Result</dt>
                          <dd className="font-medium text-fg">
                            {run.inboxItemId ? (
                              <Link href="/inbox" className="text-accent underline-offset-2 hover:underline">
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
