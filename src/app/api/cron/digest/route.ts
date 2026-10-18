import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { emailConnected, sendEmail } from "@/lib/integrations/email";
import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Weekly digest: new matches this week and deadlines in the next 14 days,
 * one email per member of each workspace that keeps the digest on. Called by
 * a scheduler with the CRON_SECRET (Authorization: Bearer or ?secret=).
 */
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret || request.nextUrl.searchParams.get("secret") === secret;
}

interface DigestInput {
  orgName: string;
  to: string[];
  matches: { title: string; funder: string; score: number; deadline: string | null }[];
  deadlines: { title: string; what: string; date: string }[];
}

export function digestText(d: DigestInput, base: string) {
  const lines = [`Your week at ${d.orgName}`, ""];
  if (d.matches.length) {
    lines.push(`${d.matches.length} new match${d.matches.length === 1 ? "" : "es"}:`);
    for (const m of d.matches) lines.push(`- ${m.title} (${m.funder}), fit ${m.score}${m.deadline ? `, due ${m.deadline}` : ""}`);
    lines.push("");
  } else lines.push("No new matches this week.", "");
  if (d.deadlines.length) {
    lines.push("Coming up in the next two weeks:");
    for (const x of d.deadlines) lines.push(`- ${x.date}: ${x.what} (${x.title})`);
    lines.push("");
  } else lines.push("Nothing due in the next two weeks.", "");
  lines.push(`Open your Inbox: ${base}/inbox`, "", `You get this because the weekly digest is on in Settings. Turn it off there any time.`);
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  if (!emailConnected()) return NextResponse.json({ ok: false, error: "Email delivery is not connected (RESEND_API_KEY)." }, { status: 503 });
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const digests: DigestInput[] = [];

  if (isDemoMode()) {
    const { state } = await import("@/lib/services/mock");
    if (state.notifications.weeklyDigest) {
      const opp = (id: string) => state.opportunities.find((o) => o.id === id);
      digests.push({
        orgName: state.org.name,
        to: state.members.filter((m) => m.status === "active").map((m) => m.email),
        matches: state.matches.filter((m) => m.createdAt >= weekAgo && m.status !== "dismissed").map((m) => ({ title: opp(m.opportunityId)?.title ?? "", funder: state.funders.find((f) => f.id === opp(m.opportunityId)?.funderId)?.name ?? "", score: m.fitScore, deadline: opp(m.opportunityId)?.deadline ?? null })),
        deadlines: state.milestones.filter((m) => !m.done && m.dueDate >= today && m.dueDate <= soon).map((m) => ({ title: opp(state.applications.find((a) => a.id === m.applicationId)?.opportunityId ?? "")?.title ?? "", what: m.title, date: m.dueDate })),
      });
    }
  } else {
    const { adminClient } = await import("@/lib/supabase/clients");
    const db = adminClient();
    const { data: orgs } = await db.from("organizations").select("id, name, notification_settings(weekly_digest)");
    for (const o of orgs ?? []) {
      const ns = Array.isArray(o.notification_settings) ? o.notification_settings[0] : o.notification_settings;
      if (ns && ns.weekly_digest === false) continue;
      const { data: members } = await db.from("org_members").select("profiles(email)").eq("org_id", o.id).eq("status", "active");
      const to = (members ?? []).map((m) => (Array.isArray(m.profiles) ? m.profiles[0]?.email : (m.profiles as { email?: string } | null)?.email)).filter((e): e is string => Boolean(e));
      if (!to.length) continue;
      const { data: matches } = await db.from("matches").select("fit_score, created_at, opportunities(title, deadline, funders(name))").eq("org_id", o.id).neq("status", "dismissed").gte("created_at", weekAgo);
      const { data: ms } = await db.from("milestones").select("title, due_date, applications(opportunities(title))").eq("org_id", o.id).eq("done", false).gte("due_date", today).lte("due_date", soon);
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
      digests.push({
        orgName: String(o.name),
        to,
        matches: (matches ?? []).map((m) => {
          const op = one(m.opportunities as { title?: string; deadline?: string; funders?: { name?: string } | { name?: string }[] } | null);
          return { title: String(op?.title ?? ""), funder: String(one(op?.funders ?? null)?.name ?? ""), score: Number(m.fit_score ?? 0), deadline: op?.deadline ? String(op.deadline).slice(0, 10) : null };
        }),
        deadlines: (ms ?? []).map((m) => ({ title: String(one(one(m.applications as { opportunities?: { title?: string } | { title?: string }[] } | null)?.opportunities ?? null)?.title ?? ""), what: String(m.title), date: String(m.due_date).slice(0, 10) })),
      });
    }
  }

  let sent = 0;
  for (const d of digests) {
    if (!d.matches.length && !d.deadlines.length) continue;
    for (const to of d.to) {
      const r = await sendEmail({ to, subject: `${PRODUCT_NAME}: ${d.matches.length} new match${d.matches.length === 1 ? "" : "es"}, ${d.deadlines.length} deadline${d.deadlines.length === 1 ? "" : "s"} coming up`, text: digestText(d, base) });
      if (r.ok) sent++;
    }
  }
  return NextResponse.json({ ok: true, workspaces: digests.length, sent });
}
