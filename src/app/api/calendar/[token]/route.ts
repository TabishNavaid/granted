import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import type { Milestone } from "@/lib/types";
import { PRODUCT_NAME } from "@/lib/brand";

/**
 * A private ICS feed per workspace: every milestone and deadline as an all-day
 * event. The token in the URL is the only credential, so it is long and random.
 */
function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcs(items: { milestone: Milestone; title: string; url: string }[], calendarName: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${PRODUCT_NAME}//Deadlines//EN`, "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcs(calendarName)}`];
  for (const { milestone: m, title, url } of items) {
    const day = m.dueDate.replace(/-/g, "");
    const next = new Date(`${m.dueDate}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:${m.id}@${PRODUCT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`, `SUMMARY:${escapeIcs(`${m.title}: ${title}`)}`, `DESCRIPTION:${escapeIcs(`${title}\n${url}`)}`, `STATUS:${m.done ? "COMPLETED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!/^[\w-]{8,128}$/.test(clean)) return new NextResponse("Not found", { status: 404 });
  let items: { milestone: Milestone; title: string; url: string }[] = [];
  let name = "Deadlines";
  if (isDemoMode()) {
    const [{ state: current, demoWorkspaces }, { samples }] = await Promise.all([import("@/lib/services/mock"), import("@/lib/mock/samples")]);
    // The open workspace, or any sample's. In the browser demo the server has only the samples, so a feed shows a sample's own dates.
    const sample = clean === current.org.calendarToken ? null : samples.find((s) => s.org.calendarToken === clean);
    if (clean !== current.org.calendarToken && !sample) return new NextResponse("Not found", { status: 404 });
    const state = sample ? demoWorkspaces.workspace(sample.id) : current;
    name = `${state.org.name} deadlines`;
    items = state.milestones.map((m) => {
      const a = state.applications.find((x) => x.id === m.applicationId);
      const o = a ? state.opportunities.find((x) => x.id === a.opportunityId) : null;
      return { milestone: m, title: o?.title ?? "", url: o?.sourceUrl ?? "" };
    });
  } else {
    const { adminClient } = await import("@/lib/supabase/clients");
    const { map } = await import("@/lib/services/supabase");
    const db = adminClient();
    const { data: org } = await db.from("organizations").select("id, name").eq("calendar_token", clean).maybeSingle();
    if (!org) return new NextResponse("Not found", { status: 404 });
    name = `${org.name} deadlines`;
    const { data: ms } = await db.from("milestones").select("*").eq("org_id", org.id);
    const { data: apps } = await db.from("applications").select("id, opportunity_id").eq("org_id", org.id);
    const oppIds = [...new Set((apps ?? []).map((a) => a.opportunity_id as string))];
    const { data: opps } = oppIds.length ? await db.from("opportunities").select("id, title, source_url").in("id", oppIds) : { data: [] };
    items = (ms ?? []).map((r) => {
      const m = map.milestone(r);
      const a = (apps ?? []).find((x) => x.id === m.applicationId);
      const o = a ? (opps ?? []).find((x) => x.id === a.opportunity_id) : null;
      return { milestone: m, title: String(o?.title ?? ""), url: String(o?.source_url ?? "") };
    });
  }
  return new NextResponse(toIcs(items, name), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
}
