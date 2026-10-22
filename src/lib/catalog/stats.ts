import snapshot from "@/data/catalog-snapshot.json";
import { hasSupabase } from "@/lib/env";
import { TYPE_LABELS, type CatalogType } from "./vocab";

/**
 * Counts for the public /data page. With a database they are read live (the
 * page revalidates every few minutes); without one (the zero-key demo) the
 * page shows the snapshot measured at the last test load, with its date.
 */
export interface SourceInfo {
  id: string;
  name: string;
  covers: string;
  homepage: string;
  docsUrl: string | null;
  termsUrl: string | null;
  license: string;
  attribution: string | null;
  kinds: CatalogType[];
  region: "us" | "state" | "local" | "international";
  cadence: string;
  needsKey: string | null;
  enabled: boolean;
}

export interface SourceCount {
  /** Federal program listings (the assistance catalog): not open calls, so counted apart. */
  programs?: number;
  open: number;
  forecasted: number;
  total: number;
  lastChecked: string | null;
  byType: Partial<Record<CatalogType, number>>;
}

export interface DataPageStats {
  live: boolean;
  /** When the counts were read: now for live counts, the snapshot's date otherwise. */
  asOf: string | null;
  label: string | null;
  sources: (SourceInfo & { count: SourceCount | null })[];
  totals: { open: number; forecasted: number; byType: Record<CatalogType, number>; funders: number; foundations: number; programs: number };
  /** Open construction and architecture-engineering bids. */
  construction: { federal: number; stateLocal: number; international: number };
}

type Snapshot = {
  measuredAt: string | null;
  label: string | null;
  sources: SourceInfo[];
  counts: Record<string, SourceCount>;
  funders: Record<string, number>;
  construction?: { federal: number; stateLocal: number; international: number };
};

function build(s: Snapshot, live: boolean, asOf: string | null): DataPageStats {
  const byType: Record<CatalogType, number> = { grant: 0, contract: 0, research: 0, scholarship: 0 };
  let open = 0;
  let forecasted = 0;
  let programs = 0;
  for (const c of Object.values(s.counts)) {
    programs += c.programs ?? 0;
    open += c.open;
    forecasted += c.forecasted;
    for (const [t, n] of Object.entries(c.byType)) byType[t as CatalogType] += n ?? 0;
  }
  const funders = Object.values(s.funders).reduce((a, b) => a + b, 0);
  return {
    live,
    asOf,
    label: s.label,
    sources: s.sources.filter((x) => x.enabled).map((x) => ({ ...x, count: s.counts[x.id] ?? null })),
    totals: { open, forecasted, byType, funders, foundations: (s.funders.private_foundation ?? 0) + (s.funders.community_foundation ?? 0), programs },
    construction: s.construction ?? { federal: 0, stateLocal: 0, international: 0 },
  };
}

export async function dataPageStats(): Promise<DataPageStats> {
  const snap = snapshot as unknown as Snapshot;
  if (!hasSupabase()) return build(snap, false, snap.measuredAt);
  try {
    const { adminClient } = await import("@/lib/supabase/clients");
    const db = adminClient();
    const [stats, funders, aec] = await Promise.all([db.rpc("catalog_public_stats"), db.rpc("catalog_public_funder_counts"), db.rpc("catalog_public_construction_stats")]);
    if (stats.error || funders.error) throw new Error(stats.error?.message ?? funders.error?.message);
    const counts: Record<string, SourceCount> = {};
    for (const r of (stats.data ?? []) as { source: string; type: CatalogType; open_count: number; forecasted_count: number; total_count: number; last_checked: string | null; program_count: number }[]) {
      const c = (counts[r.source] ??= { open: 0, forecasted: 0, total: 0, lastChecked: null, byType: {}, programs: 0 });
      c.programs = (c.programs ?? 0) + Number(r.program_count ?? 0);
      c.open += Number(r.open_count);
      c.forecasted += Number(r.forecasted_count);
      c.total += Number(r.total_count);
      c.byType[r.type] = (c.byType[r.type] ?? 0) + Number(r.open_count) + Number(r.forecasted_count);
      if (r.last_checked && (!c.lastChecked || r.last_checked > c.lastChecked)) c.lastChecked = r.last_checked;
    }
    const f = Object.fromEntries(((funders.data ?? []) as { kind: string; funder_count: number }[]).map((r) => [r.kind, Number(r.funder_count)]));
    const c = Object.fromEntries(((aec.data ?? []) as { scope: string; open_count: number }[]).map((r) => [r.scope, Number(r.open_count)]));
    return build({ ...snap, counts, funders: f, label: null, construction: { federal: c.federal ?? 0, stateLocal: c.state_local ?? 0, international: c.international ?? 0 } }, true, new Date().toISOString());
  } catch {
    return build(snap, false, snap.measuredAt);
  }
}

/** How the /data page groups sources. A source not listed falls into "Other sources". */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Federal grants and programs", ids: ["grantsgov", "federal_register", "sam_assistance"] },
  { title: "Federal contracts", ids: ["sam_opportunities"] },
  { title: "State and city bids", ids: [] },
  { title: "Research funding", ids: ["nih_guide", "nsf_funding", "sbir_topics", "nasa_nspires"] },
  { title: "Foundations and nonprofits", ids: ["irs_990pf", "irs_registry"] },
  { title: "Scholarships and fellowships", ids: ["curated_scholarships"] },
  { title: "Outside the United States", ids: [] },
  { title: "Past awards (totals only)", ids: ["usaspending", "nih_reporter", "nsf_awards", "sbir_awards"] },
];

export function groupSources<T extends SourceInfo>(sources: T[]): { title: string; sources: T[] }[] {
  const out = GROUPS.map((g) => ({
    title: g.title,
    sources: sources.filter((s) =>
      g.title === "State and city bids" ? s.region === "state" || s.region === "local" : g.title === "Outside the United States" ? s.region === "international" : g.ids.includes(s.id),
    ),
  }));
  const used = new Set(out.flatMap((g) => g.sources.map((s) => s.id)));
  const rest = sources.filter((s) => !used.has(s.id));
  if (rest.length) out.push({ title: "Other sources", sources: rest });
  return out.filter((g) => g.sources.length);
}

export { TYPE_LABELS };
