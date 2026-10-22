import { NextResponse, type NextRequest } from "next/server";
import { canonicalUrl } from "@/lib/site-url";
import { isDemoMode } from "@/lib/env";
import { emailConnected, sendEmail } from "@/lib/integrations/email";
import { deadlineReminderEmail } from "@/lib/email/templates";
import { unsubscribeLinks } from "@/lib/email/unsubscribe";

/**
 * Deadline reminders: milestones coming due within each workspace's reminder window, grouped into one email
 * per person (the assignee, else the owner), each milestone reminded once (reminder_sent_at). Daily from
 * Vercel Cron with CRON_SECRET. The public demo never sends: its reminder outbox shows what would go out.
 */
export const maxDuration = 300;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") === secret;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  if (isDemoMode()) return NextResponse.json({ ok: true, sent: 0, note: "The demo does not send email. See the reminder outbox on Calendar." });
  if (!emailConnected()) return NextResponse.json({ ok: false, error: "Email delivery is not connected (RESEND_API_KEY)." }, { status: 503 });
  const [{ adminClient }, { optedOut }] = await Promise.all([import("@/lib/supabase/clients"), import("@/lib/email/opt-outs")]);
  const db = adminClient();
  const base = canonicalUrl();
  const today = new Date().toISOString().slice(0, 10);
  const { data: orgs } = await db.from("organizations").select("id, name, notification_settings(milestone_reminders, reminder_days_before)");
  let sent = 0;
  for (const o of orgs ?? []) {
    const ns = one(o.notification_settings as { milestone_reminders?: boolean; reminder_days_before?: number } | null);
    if (ns?.milestone_reminders === false) continue;
    const until = new Date(Date.now() + Number(ns?.reminder_days_before ?? 3) * 864e5).toISOString().slice(0, 10);
    const { data: due } = await db.from("milestones").select("id, title, due_date, assignee_id, application_id, applications(opportunities(title))").eq("org_id", o.id).eq("done", false).is("reminder_sent_at", null).gte("due_date", today).lte("due_date", until).order("due_date");
    if (!due?.length) continue;
    const { data: members } = await db.from("org_members").select("user_id, role, profiles(email)").eq("org_id", o.id).eq("status", "active");
    const owner = (members ?? []).find((m) => m.role === "owner") ?? (members ?? [])[0];
    const emailOf = (userId: string | null) => one(((members ?? []).find((m) => m.user_id === userId) ?? owner)?.profiles as { email?: string } | null)?.email ?? null;
    const out = await optedOut(String(o.id), "reminders");
    const byPerson = new Map<string, typeof due>();
    for (const m of due) {
      const to = emailOf((m.assignee_id as string | null) ?? null);
      if (!to || out.has(to.toLowerCase())) continue;
      byPerson.set(to, [...(byPerson.get(to) ?? []), m]);
    }
    for (const [to, list] of byPerson) {
      const links = unsubscribeLinks(base, { email: to, orgId: String(o.id), category: "reminders" });
      const t = deadlineReminderEmail({
        workspaceName: String(o.name),
        items: list.map((m) => ({ title: String(m.title), application: String(one(one(m.applications as { opportunities?: { title?: string } | null } | null)?.opportunities ?? null)?.title ?? "An application"), date: String(m.due_date), url: `${base}/applications/${m.application_id}` })),
        calendarUrl: `${base}/calendar`,
        unsubscribeUrl: links?.page ?? `${base}/settings?tab=notifications`,
      });
      const r = await sendEmail({ to, subject: t.subject, text: t.text, html: t.html, unsubscribeUrl: links?.oneClick, tags: [{ name: "category", value: "reminders" }] });
      if (r.ok) {
        sent++;
        await db.from("milestones").update({ reminder_sent_at: new Date().toISOString() }).in("id", list.map((m) => m.id));
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
