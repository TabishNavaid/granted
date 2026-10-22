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
  totals: { open: number; forecasted: number; byType: Record<CatalogType, number>; funders: number; foundations: number };
}

type Snapshot = {
  measuredAt: string | null;
  label: string | null;
  sources: SourceInfo[];
  counts: Record<string, SourceCount>;
  funders: Record<string, number>;
};

function build(s: Snapshot, live: boolean, asOf: string | null): DataPageStats {
  const byType: Record<CatalogType, number> = { grant: 0, contract: 0, research: 0, scholarship: 0 };
  let open = 0;
  let forecasted = 0;
  for (const c of Object.values(s.counts)) {
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
    totals: { open, forecasted, byType, funders, foundations: (s.funders.private_foundation ?? 0) + (s.funders.community_foundation ?? 0) },
  };
}

export async function dataPageStats(): Promise<DataPageStats> {
  const snap = snapshot as unknown as Snapshot;
  if (!hasSupabase()) return build(snap, false, snap.measuredAt);
  try {
    const { adminClient } = await import("@/lib/supabase/clients");
    const db = adminClient();
    const [stats, funders] = await Promise.all([db.rpc("catalog_public_stats"), db.rpc("catalog_public_funder_counts")]);
    if (stats.error || funders.error) throw new Error(stats.error?.message ?? funders.error?.message);
    const counts: Record<string, SourceCount> = {};
    for (const r of (stats.data ?? []) as { source: string; type: CatalogType; open_count: number; forecasted_count: number; total_count: number; last_checked: string | null }[]) {
      const c = (counts[r.source] ??= { open: 0, forecasted: 0, total: 0, lastChecked: null, byType: {} });
      c.open += Number(r.open_count);
      c.forecasted += Number(r.forecasted_count);
      c.total += Number(r.total_count);
      c.byType[r.type] = (c.byType[r.type] ?? 0) + Number(r.open_count) + Number(r.forecasted_count);
      if (r.last_checked && (!c.lastChecked || r.last_checked > c.lastChecked)) c.lastChecked = r.last_checked;
    }
    const f = Object.fromEntries(((funders.data ?? []) as { kind: string; funder_count: number }[]).map((r) => [r.kind, Number(r.funder_count)]));
    return build({ ...snap, counts, funders: f, label: null }, true, new Date().toISOString());
  } catch {
    return build(snap, false, snap.measuredAt);
  }
}

export const KIND_GROUPS: { title: string; test: (s: SourceInfo) => boolean }[] = [
  { title: "Federal grants and programs", test: (s) => s.region === "us" && s.kinds.includes("grant") && !s.kinds.includes("contract") && !/990|foundation/i.test(s.name) },
  { title: "Contracts and public bids", test: (s) => s.kinds.includes("contract") },
  { title: "Research funding", test: (s) => s.kinds.includes("research") && !s.kinds.includes("grant") },
  { title: "Foundations and nonprofits", test: (s) => /990|foundation|exempt|irs/i.test(`${s.name} ${s.id}`) },
  { title: "Scholarships and fellowships", test: (s) => s.kinds.length === 1 && s.kinds[0] === "scholarship" },
  { title: "Past awards", test: (s) => s.kinds.length === 0 || /award|spending|reporter/i.test(`${s.name} ${s.id}`) },
];

export function groupSources<T extends SourceInfo>(sources: T[]): { title: string; sources: T[] }[] {
  const used = new Set<string>();
  const out: { title: string; sources: T[] }[] = [];
  for (const g of KIND_GROUPS) {
    const list = sources.filter((s) => !used.has(s.id) && g.test(s));
    list.forEach((s) => used.add(s.id));
    if (list.length) out.push({ title: g.title, sources: list });
  }
  const rest = sources.filter((s) => !used.has(s.id));
  if (rest.length) out.push({ title: "Other sources", sources: rest });
  return out;
}

export { TYPE_LABELS };
