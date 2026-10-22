import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { isAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Ingestion log", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Run {
  id: number;
  source: string;
  mode: string;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_seen: number;
  rows_added: number;
  rows_updated: number;
  rows_closed: number;
  funders_upserted: number;
  awards_upserted: number;
  error_count: number;
  errors: { message: string; detail?: string }[];
  notes: string | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }) : "Still running");
const secs = (ms: number | null) => (ms == null ? "" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`);
const nf = new Intl.NumberFormat("en-US");

export default async function IngestionPage() {
  if (isDemoMode() || !hasSupabase()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-h1 text-ink">Ingestion log</h1>
        <p className="mt-4 text-base text-ink-muted">This page reads the database, and this deployment is running the demo without one.</p>
      </main>
    );
  }
  const { getSession } = await import("@/lib/supabase/session");
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/admin/ingestion");
  if (!isAdmin(session.email)) notFound();

  const { adminClient } = await import("@/lib/supabase/clients");
  const db = adminClient();
  const [runs, sources, stats] = await Promise.all([
    db.from("catalog_ingest_runs").select("*").order("started_at", { ascending: false }).limit(150),
    db.from("catalog_sources").select("id, name, cadence, enabled, needs_key").order("name"),
    db.rpc("catalog_public_stats"),
  ]);
  const list = (runs.data ?? []) as Run[];
  const latest = new Map<string, Run>();
  for (const r of list) if (!latest.has(r.source)) latest.set(r.source, r);
  const open = new Map<string, number>();
  for (const r of (stats.data ?? []) as { source: string; open_count: number; forecasted_count: number }[]) open.set(r.source, (open.get(r.source) ?? 0) + Number(r.open_count) + Number(r.forecasted_count));

  return (
    <main className="mx-auto max-w-[80rem] px-4 py-12 sm:px-6 lg:px-10">
      <p className="flex gap-4 text-sm text-ink-muted">
        <Link href="/inbox" className="underline underline-offset-2">
          Back to the app
        </Link>
        <Link href="/admin/errors" className="underline underline-offset-2">
          Errors
        </Link>
      </p>
      <h1 className="mt-4 font-display text-h1 text-ink">Ingestion log</h1>
      <p className="mt-3 max-w-[65ch] text-base text-ink-muted">Every scheduled and manual run of the opportunity database jobs. They run in GitHub Actions, not on Vercel. Times are UTC.</p>

      <h2 className="mt-12 font-display text-2xl text-ink">Sources</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-ink text-ink-muted">
            <tr>
              <th className="py-2 pr-4 font-normal">Source</th>
              <th className="py-2 pr-4 font-normal">Schedule</th>
              <th className="py-2 pr-4 font-normal">Last run</th>
              <th className="py-2 pr-4 font-normal">Result</th>
              <th className="py-2 pr-4 text-right font-normal">Open now</th>
            </tr>
          </thead>
          <tbody>
            {(sources.data ?? []).map((s) => {
              const r = latest.get(String(s.id));
              return (
                <tr key={String(s.id)} className="border-b border-rule">
                  <td className="py-2.5 pr-4 text-ink">
                    {String(s.name)}
                    {s.needs_key ? <span className="ml-2 text-ink-muted">needs {String(s.needs_key)}</span> : null}
                    {s.enabled === false ? <span className="ml-2 text-ink-muted">off</span> : null}
                  </td>
                  <td className="py-2.5 pr-4 text-ink-muted">{String(s.cadence)}</td>
                  <td className="py-2.5 pr-4 text-ink-muted">{r ? when(r.finished_at ?? r.started_at) : "Never"}</td>
                  <td className={`py-2.5 pr-4 ${r?.status === "failed" ? "font-semibold text-alert" : "text-ink"}`}>{r ? `${r.status}, ${nf.format(r.rows_added)} added, ${nf.format(r.rows_updated)} updated${r.error_count ? `, ${r.error_count} errors` : ""}` : ""}</td>
                  <td className="py-2.5 pr-4 text-right text-ink tnum">{nf.format(open.get(String(s.id)) ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 font-display text-2xl text-ink">Recent runs</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-ink text-ink-muted">
            <tr>
              <th className="py-2 pr-4 font-normal">Started</th>
              <th className="py-2 pr-4 font-normal">Source</th>
              <th className="py-2 pr-4 font-normal">Mode</th>
              <th className="py-2 pr-4 font-normal">Status</th>
              <th className="py-2 pr-4 text-right font-normal">Seen</th>
              <th className="py-2 pr-4 text-right font-normal">Added</th>
              <th className="py-2 pr-4 text-right font-normal">Updated</th>
              <th className="py-2 pr-4 text-right font-normal">Closed</th>
              <th className="py-2 pr-4 text-right font-normal">Time</th>
              <th className="py-2 pr-4 font-normal">Errors</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-rule align-top">
                <td className="py-2 pr-4 text-ink-muted">{when(r.started_at)}</td>
                <td className="py-2 pr-4 text-ink">{r.source}</td>
                <td className="py-2 pr-4 text-ink-muted">
                  {r.mode}, {r.trigger}
                </td>
                <td className={`py-2 pr-4 ${r.status === "failed" ? "font-semibold text-alert" : "text-ink"}`}>{r.status}</td>
                <td className="py-2 pr-4 text-right tnum">{nf.format(r.rows_seen)}</td>
                <td className="py-2 pr-4 text-right tnum">{nf.format(r.rows_added)}</td>
                <td className="py-2 pr-4 text-right tnum">{nf.format(r.rows_updated)}</td>
                <td className="py-2 pr-4 text-right tnum">{nf.format(r.rows_closed)}</td>
                <td className="py-2 pr-4 text-right tnum">{secs(r.duration_ms)}</td>
                <td className="max-w-[24rem] py-2 pr-4 text-ink-muted">{r.error_count ? `${r.error_count}: ${r.errors[0]?.message ?? ""}` : r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
