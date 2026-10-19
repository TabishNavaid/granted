"use client";

import Link from "next/link";
import type { AnalyticsRow, WinAnalytics } from "@/lib/types";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Rates resting on fewer decisions than this read as anecdotes, and the page says so. */
const SMALL = 3;

function Rate({ rate, n }: { rate: number | null; n: number }) {
  return (
    <span className="whitespace-nowrap tnum">
      <span className={cn(n < SMALL ? "text-ink-muted" : "font-semibold text-ink")}>{rate == null ? "No rate" : `${rate}%`}</span>
      <span className="ml-1.5 text-xs text-ink-muted">n {n}</span>
    </span>
  );
}

const columns: Column<AnalyticsRow>[] = [
  { key: "label", header: "Group", cell: (r) => <span className="text-ink">{r.label}</span>, className: "min-w-[8.5rem] sm:min-w-[11rem]" },
  { key: "decided", header: "Decided", hideBelow: "sm", cell: (r) => <span className="tnum">{r.decided}</span>, align: "right" },
  { key: "won", header: "Won", cell: (r) => <span className="tnum">{r.won}</span>, align: "right" },
  { key: "rate", header: "Win rate", cell: (r) => <Rate rate={r.winRate} n={r.decided} />, align: "right" },
  { key: "dollars", header: "Dollars won", cell: (r) => <span className="tnum">{formatMoney(r.dollarsWon)}</span>, align: "right", hideBelow: "sm" },
];

function RowsTable({ id, title, note, rows }: { id: string; title: string; note?: string; rows: AnalyticsRow[] }) {
  const thin = rows.some((r) => r.decided < SMALL);
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="font-display text-2xl text-ink">
        {title}
      </h2>
      {note ? <p className="mt-2 max-w-[65ch] text-base text-ink-muted">{note}</p> : null}
      <DataTable className="mt-4" columns={columns} rows={rows} rowKey={(r) => r.label} caption={title} emptyMessage="No decided applications in this view yet." />
      {thin ? <p className="mt-2 text-sm text-ink-muted">Rates in grey rest on fewer than {SMALL} decisions. Read them as single stories, not patterns.</p> : null}
    </section>
  );
}

function monthLabel(month: string) {
  return formatDate(`${month}-01`, "MMM yyyy");
}

/** Asked and won by month, as plain horizontal bars on one dollar axis. */
function Timeline({ timeline }: { timeline: WinAnalytics["timeline"] }) {
  const max = Math.max(1, ...timeline.map((t) => Math.max(t.asked, t.won)));
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <section aria-labelledby="timeline-title" className="mt-12">
      <h2 id="timeline-title" className="font-display text-2xl text-ink">
        Asked and won by month
      </h2>
      <p className="mt-2 max-w-[65ch] text-base text-ink-muted">Each month is when the decision came back. The asked bar is the full request; the won bar is what was awarded.</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm bg-rule-strong" />
          Asked
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm bg-meadow" />
          Won
        </span>
      </div>
      <figure className="mt-3">
        <ol className="border-t border-rule">
          {timeline.map((t) => (
            <li key={t.month} className="grid grid-cols-[4.75rem_1fr] items-center gap-3 border-b border-rule py-2.5 sm:grid-cols-[6rem_1fr]">
              <span className="text-sm text-ink tnum">{monthLabel(t.month)}</span>
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2" title={`${monthLabel(t.month)}: asked ${formatMoney(t.asked)}`}>
                  <div className="h-2.5 min-w-0 flex-1">
                    <div className="h-full rounded-r-sm bg-rule-strong" style={{ width: pct(t.asked) }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-ink-muted tnum">
                    <span className="sr-only">Asked </span>
                    {formatMoney(t.asked, { compact: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2" title={`${monthLabel(t.month)}: won ${formatMoney(t.won)}`}>
                  <div className="h-2.5 min-w-0 flex-1">
                    <div className="h-full rounded-r-sm bg-meadow" style={{ width: pct(t.won) }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-ink tnum">
                    <span className="sr-only">Won </span>
                    {formatMoney(t.won, { compact: true })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-[4.75rem_1fr] gap-3 pt-2 sm:grid-cols-[6rem_1fr]" aria-hidden>
          <span className="text-xs text-ink-muted">Month</span>
          <div className="flex items-start gap-2">
            <div className="flex flex-1 justify-between text-xs text-ink-muted tnum">
              <span>$0</span>
              <span>{formatMoney(max / 2, { compact: true })}</span>
              <span>{formatMoney(max, { compact: true })}</span>
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-ink-muted">Dollars</span>
          </div>
        </div>
        <figcaption className="sr-only">Dollars asked and won for each month a decision came back.</figcaption>
      </figure>
    </section>
  );
}

export function AnalyticsView({ data }: { data: WinAnalytics }) {
  const header = <PageHeader title="Win analytics" description="What your decided applications say about where you win. Counted from your own pipeline, with the number of decisions behind every rate." />;

  if (data.decided < SMALL) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          className="mt-8"
          title={data.decided === 0 ? "No decisions logged yet" : `${pluralize(data.decided, "decision")} so far`}
          description={`This page fills in as you log outcomes on the Pipeline: won, declined, or no response, with the reason when you know it. With fewer than ${SMALL} decisions there is no pattern to show yet.${data.pending ? ` ${pluralize(data.pending, "application")} worth ${formatMoney(data.pendingAsk)} ${data.pending === 1 ? "is" : "are"} waiting on a decision.` : ""}`}
          action={
            <Button asChild>
              <Link href="/pipeline">Log an outcome on the Pipeline</Link>
            </Button>
          }
        />
        {data.lessons.length ? <Lessons lessons={data.lessons} /> : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}

      <dl className="mt-8 grid grid-cols-2 gap-6 border-b border-rule pb-6 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-ink-muted">Dollars won</dt>
          <dd className="mt-1 font-display text-2xl text-ink tnum">{formatMoney(data.dollarsWon)}</dd>
          <dd className="mt-1 text-sm text-ink-muted tnum">of {formatMoney(data.dollarsAsked)} asked</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Decided applications</dt>
          <dd className="mt-1 font-display text-2xl text-ink tnum">{data.decided}</dd>
          <dd className="mt-1 text-sm text-ink-muted tnum">
            {data.won} won, {data.lost} declined, {data.noResponse} no response
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Win rate</dt>
          <dd className="mt-1 font-display text-2xl text-ink tnum">{data.winRate == null ? "No rate" : `${data.winRate}%`}</dd>
          <dd className="mt-1 text-sm text-ink-muted tnum">n {data.decided}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Pending asks</dt>
          <dd className="mt-1 font-display text-2xl text-ink tnum">{formatMoney(data.pendingAsk)}</dd>
          <dd className="mt-1 text-sm text-ink-muted tnum">{pluralize(data.pending, "application")} waiting</dd>
        </div>
      </dl>

      {data.findings.length ? (
        <section aria-labelledby="findings-title" className="mt-10">
          <h2 id="findings-title" className="font-display text-2xl text-ink">
            What the numbers suggest
          </h2>
          <ul className="mt-4 border-t border-rule">
            {data.findings.map((f) => (
              <li key={f} className="max-w-[70ch] border-b border-rule py-3 text-base text-ink">
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.timeline.length ? <Timeline timeline={data.timeline} /> : null}

      <RowsTable id="type-title" title="By funder type" rows={data.byFunderType} />
      <RowsTable id="size-title" title="By ask size" rows={data.byAskSize} />
      <RowsTable id="rel-title" title="First request or returning" rows={data.byRelationship} />
      <RowsTable
        id="section-title"
        title="Sections present"
        note="Each row counts the decided applications that had this kind of section written. One application can sit in several rows."
        rows={data.bySection}
      />
      <RowsTable id="funder-title" title="By funder" rows={data.byFunder} />

      <section aria-labelledby="reasons-title" className="mt-12">
        <h2 id="reasons-title" className="font-display text-2xl text-ink">
          Why applications were declined
        </h2>
        {data.lossReasons.length ? (
          <>
            <ul className="mt-4 border-t border-rule">
              {data.lossReasons.map((r) => (
                <li key={r.reason} className="flex items-baseline justify-between gap-6 border-b border-rule py-3 text-base">
                  <span className="text-ink">{r.label}</span>
                  <span className="shrink-0 font-semibold text-ink tnum">{r.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-ink-muted">One decline can carry more than one reason. Reasons come from what the funder said or what you judged when you logged it.</p>
          </>
        ) : (
          <p className="mt-3 text-base text-ink-muted">No declines logged yet.</p>
        )}
      </section>

      <Lessons lessons={data.lessons} />
    </PageContainer>
  );
}

function Lessons({ lessons }: { lessons: WinAnalytics["lessons"] }) {
  return (
    <section aria-labelledby="lessons-title" className="mt-12">
      <h2 id="lessons-title" className="font-display text-2xl text-ink">
        Lessons you wrote down
      </h2>
      {lessons.length ? (
        <ul className="mt-4 border-t border-rule">
          {lessons.map((l) => (
            <li key={l.applicationTitle + l.decidedAt} className="border-b border-rule py-4">
              <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span className="font-semibold text-ink">{l.funder || l.applicationTitle}</span>
                {l.funder ? <span>{l.applicationTitle}</span> : null}
                <time dateTime={l.decidedAt} className="tnum">
                  {formatDate(l.decidedAt)}
                </time>
              </p>
              <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-base text-ink">{l.lessons}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 max-w-[65ch] text-base text-ink-muted">
          When you log an outcome on the{" "}
          <Link href="/pipeline" className="text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink">
            Pipeline
          </Link>
          , you can note what the next application should do differently. Those notes collect here.
        </p>
      )}
    </section>
  );
}
