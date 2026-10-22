import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasSupabase, isDemoMode } from "@/lib/env";
import { isAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Errors", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface ErrorGroup {
  fingerprint: string;
  kind: "server" | "client";
  message: string;
  digest: string | null;
  route: string | null;
  path: string | null;
  detail: Record<string, string | null>;
  count: number;
  first_seen: string;
  last_seen: string;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
const nf = new Intl.NumberFormat("en-US");

export default async function ErrorsPage() {
  if (isDemoMode() || !hasSupabase()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-h1 text-ink">Errors</h1>
        <p className="mt-4 text-base text-ink-muted">This deployment runs the demo without a database, so errors go only to the runtime logs.</p>
      </main>
    );
  }
  const { getSession } = await import("@/lib/supabase/session");
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/admin/errors");
  if (!isAdmin(session.email)) notFound();

  const { adminClient } = await import("@/lib/supabase/clients");
  const { data } = await adminClient().from("app_errors").select("*").order("last_seen", { ascending: false }).limit(200);
  const groups = (data ?? []) as ErrorGroup[];
  const since = new Date(new Date().getTime() - 864e5).toISOString();
  const day = groups.filter((g) => g.last_seen >= since);

  return (
    <main className="mx-auto max-w-[80rem] px-4 py-12 sm:px-6 lg:px-10">
      <p className="flex gap-4 text-sm text-ink-muted">
        <Link href="/inbox" className="underline underline-offset-2">
          Back to the app
        </Link>
        <Link href="/admin/ingestion" className="underline underline-offset-2">
          Ingestion log
        </Link>
      </p>
      <h1 className="mt-4 font-display text-h1 text-ink">Errors</h1>
      <p className="mt-3 max-w-[65ch] text-base text-ink-muted">
        Server and browser errors, grouped when the message and route match. {day.length ? `${day.length} ${day.length === 1 ? "group" : "groups"} seen in the last 24 hours.` : "None in the last 24 hours."} Groups not seen for 30 days are removed. Times are UTC.
      </p>
      {groups.length ? (
        <ul className="mt-10 flex flex-col">
          {groups.map((g) => (
            <li key={g.fingerprint} className="border-b border-rule py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="font-mono text-sm text-ink">{g.message}</p>
                <p className="text-sm text-ink-muted tnum">
                  {nf.format(g.count)} {g.count === 1 ? "time" : "times"}, last {when(g.last_seen)}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {g.kind === "server" ? "Server" : "Browser"}
                {g.route ? `, ${g.route}` : ""}
                {g.path && g.path !== g.route ? `, ${g.path}` : ""}
                {g.digest ? `, digest ${g.digest}` : ""}, first {when(g.first_seen)}
              </p>
              {g.detail?.stack ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-ink-muted">Stack</summary>
                  <pre className="mt-2 overflow-x-auto bg-paper-tint p-3 font-mono text-xs text-ink">{g.detail.stack}</pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-base text-ink">No errors recorded.</p>
      )}
    </main>
  );
}
