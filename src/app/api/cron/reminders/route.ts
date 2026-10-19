import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { isDemoMode } from "@/lib/env";
import { emailConnected, sendEmail } from "@/lib/integrations/email";
import { PRODUCT_NAME } from "@/lib/brand";

/**
 * Reminder emails before each milestone. Run it hourly or daily from any
 * scheduler with the CRON_SECRET (Authorization: Bearer or ?secret=). Each
 * workspace's notification settings decide whether and how many days ahead;
 * `reminder_sent_at` makes sure each milestone is reminded once. The public
 * demo never sends: its reminder outbox shows what would go out instead.
 */
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret || request.nextUrl.searchParams.get("secret") === secret;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  if (isDemoMode()) return NextResponse.json({ ok: true, sent: 0, note: "The demo does not send email. See the reminder outbox on Calendar." });
  if (!emailConnected()) return NextResponse.json({ ok: false, error: "Email delivery is not connected (RESEND_API_KEY)." }, { status: 503 });
  const { adminClient } = await import("@/lib/supabase/clients");
  const db = adminClient();
  const base = siteUrl();
  const today = new Date().toISOString().slice(0, 10);
  const { data: orgs } = await db.from("organizations").select("id, name, notification_settings(milestone_reminders, reminder_days_before)");
  let sent = 0;
  for (const o of orgs ?? []) {
    const ns = one(o.notification_settings as { milestone_reminders?: boolean; reminder_days_before?: number } | { milestone_reminders?: boolean; reminder_days_before?: number }[] | null);
    if (ns?.milestone_reminders === false) continue;
    const days = Number(ns?.reminder_days_before ?? 3);
    const until = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    const { data: due } = await db.from("milestones").select("id, title, due_date, assignee_id, applications(opportunities(title))").eq("org_id", o.id).eq("done", false).is("reminder_sent_at", null).gte("due_date", today).lte("due_date", until);
    if (!due?.length) continue;
    const { data: members } = await db.from("org_members").select("user_id, profiles(email)").eq("org_id", o.id).eq("status", "active");
    const emailOf = (userId: string | null) => {
      const m = (members ?? []).find((x) => x.user_id === userId) ?? (members ?? [])[0];
      return one(m?.profiles as { email?: string } | { email?: string }[] | null)?.email ?? null;
    };
    for (const m of due) {
      const to = emailOf((m.assignee_id as string | null) ?? null);
      if (!to) continue;
      const title = one(one(m.applications as { opportunities?: { title?: string } | { title?: string }[] } | null)?.opportunities)?.title ?? "an application";
      const date = new Date(`${String(m.due_date).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const r = await sendEmail({ to, subject: `${PRODUCT_NAME}: ${m.title} due ${date}`, text: `${m.title} for ${title} is due ${date}.\n\nSee what is left: ${base}/calendar\n\nYou get this because milestone reminders are on in Settings.` });
      if (r.ok) {
        sent++;
        await db.from("milestones").update({ reminder_sent_at: new Date().toISOString() }).eq("id", m.id);
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
