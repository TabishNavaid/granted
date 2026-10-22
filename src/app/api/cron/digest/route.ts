import { NextResponse, type NextRequest } from "next/server";
import { canonicalUrl } from "@/lib/site-url";
import { isDemoMode } from "@/lib/env";
import { emailConnected, sendEmail } from "@/lib/integrations/email";
import { weeklyDigestEmail, type DigestMatch, type ReminderItem } from "@/lib/email/templates";
import { unsubscribeLinks } from "@/lib/email/unsubscribe";

/**
 * The weekly digest, Mondays: new matches in the workspace, opportunities newly posted to the database that
 * fit it, and deadlines in the next 14 days. One email per active member who has not unsubscribed, in
 * workspaces with the digest on. Vercel Cron calls this with CRON_SECRET (vercel.json).
 */
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const money = (n: number | null) => (n ? `up to $${Math.round(n).toLocaleString("en-US")}` : null);

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  if (isDemoMode()) return NextResponse.json({ ok: true, sent: 0, note: "The demo does not send email. Settings shows the digest as it would read." });
  if (!emailConnected()) return NextResponse.json({ ok: false, error: "Email delivery is not connected (RESEND_API_KEY)." }, { status: 503 });
  const [{ adminClient }, { optedOut }, catalog] = await Promise.all([import("@/lib/supabase/clients"), import("@/lib/email/opt-outs"), import("@/lib/catalog/app")]);
  const db = adminClient();
  const base = canonicalUrl();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const { data: orgs } = await db.from("organizations").select("id, name, org_type, state, causes, notification_settings(weekly_digest), firm_profiles(data)");
  let sent = 0;
  let skipped = 0;
  for (const o of orgs ?? []) {
    if (one(o.notification_settings as { weekly_digest?: boolean } | null)?.weekly_digest === false) continue;
    const { data: members } = await db.from("org_members").select("profiles(email)").eq("org_id", o.id).eq("status", "active");
    const out = await optedOut(String(o.id), "digest");
    const to = (members ?? []).map((m) => one(m.profiles as { email?: string } | null)?.email).filter((e): e is string => Boolean(e) && !out.has(String(e).toLowerCase()));
    if (!to.length) continue;
    const { data: matches } = await db.from("matches").select("fit_score, opportunities(title, deadline, amount_max, source_url, funders(name))").eq("org_id", o.id).neq("status", "dismissed").gte("created_at", weekAgo).order("fit_score", { ascending: false }).limit(6);
    const { data: ms } = await db.from("milestones").select("title, due_date, application_id, applications(opportunities(title))").eq("org_id", o.id).eq("done", false).gte("due_date", today).lte("due_date", soon).order("due_date");
    const firm = one(o.firm_profiles as { data?: { naics?: { code: string }[]; states?: string[] } } | null)?.data;
    let fresh: DigestMatch[] = [];
    try {
      const hits = await catalog.newForWorkspace({ orgType: String(o.org_type ?? "nonprofit"), state: (o.state as string | null) ?? null, causes: (o.causes as string[] | null) ?? [], naics: firm?.naics?.map((n) => n.code), states: firm?.states }, weekAgo, 6);
      fresh = hits.map((h) => ({ title: h.title, funder: h.funder_name ?? "", url: h.source_url, deadline: h.close_at, amount: money(h.amount_max), source: catalog.sourceName(h.source) }));
    } catch {
      // The digest still goes out with the workspace's own news.
    }
    const own: DigestMatch[] = (matches ?? []).map((m) => {
      const op = one(m.opportunities as { title?: string; deadline?: string; amount_max?: number; source_url?: string; funders?: { name?: string } | null } | null);
      return { title: String(op?.title ?? ""), funder: String(one(op?.funders ?? null)?.name ?? ""), url: `${base}/inbox`, deadline: op?.deadline ?? null, amount: money(op?.amount_max ?? null), source: "your matches", fit: Number(m.fit_score ?? 0) };
    });
    const deadlines: ReminderItem[] = (ms ?? []).map((m) => ({ title: String(m.title), application: String(one(one(m.applications as { opportunities?: { title?: string } | null } | null)?.opportunities ?? null)?.title ?? "An application"), date: String(m.due_date), url: `${base}/applications/${m.application_id}` }));
    if (!own.length && !fresh.length && !deadlines.length) {
      skipped++;
      continue;
    }
    for (const email of to) {
      const links = unsubscribeLinks(base, { email, orgId: String(o.id), category: "digest" });
      const t = weeklyDigestEmail({ workspaceName: String(o.name), matches: own, databaseNew: fresh, deadlines, inboxUrl: `${base}/inbox`, unsubscribeUrl: links?.page ?? `${base}/settings?tab=notifications` });
      const r = await sendEmail({ to: email, subject: t.subject, text: t.text, html: t.html, unsubscribeUrl: links?.oneClick, tags: [{ name: "category", value: "digest" }] });
      if (r.ok) sent++;
    }
  }
  return NextResponse.json({ ok: true, sent, quiet: skipped });
}
