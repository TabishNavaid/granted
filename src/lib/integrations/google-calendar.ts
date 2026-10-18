import { createHash } from "node:crypto";
import { freshAccessToken } from "@/lib/integrations/oauth";

export interface CalendarEventInput {
  id: string;
  title: string;
  /** The day, as YYYY-MM-DD or any ISO date string. Pushed as an all-day event. */
  date: string;
  description: string;
}

export type PushResult = { ok: true; pushed: number } | { ok: false; reason: "not_connected" | "failed"; message: string };

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Google event ids must match [a-v0-9]{5,1024}; sha1 hex digits all fall inside that alphabet. */
export function calendarEventId(id: string): string {
  return createHash("sha1").update(id).digest("hex");
}

function dayOf(date: string): { start: string; end: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(date);
  const day = m ? m[1] : Number.isNaN(Date.parse(date)) ? null : new Date(date).toISOString().slice(0, 10);
  if (!day) return null;
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  // All-day events end on the following day, exclusive.
  return { start: day, end: next.toISOString().slice(0, 10) };
}

export async function pushEvents(orgId: string, events: CalendarEventInput[]): Promise<PushResult> {
  const token = await freshAccessToken(orgId, "google");
  if (!token.ok) return { ok: false, reason: "not_connected", message: token.message };
  const headers = { authorization: `Bearer ${token.token}`, "content-type": "application/json" };
  let pushed = 0;
  let lastError = "";
  for (const ev of events) {
    const day = dayOf(ev.date);
    if (!day) {
      lastError = `Could not read the date for "${ev.title}".`;
      continue;
    }
    const eventId = calendarEventId(ev.id);
    // status is set so re-pushing an event the user deleted brings it back instead of silently updating a cancelled one.
    const body = JSON.stringify({ id: eventId, summary: ev.title, description: ev.description, start: { date: day.start }, end: { date: day.end }, status: "confirmed" });
    try {
      let res = await fetch(`${EVENTS_URL}/${eventId}`, { method: "PUT", headers, body });
      if (res.status === 404) res = await fetch(EVENTS_URL, { method: "POST", headers, body });
      if (res.ok) pushed += 1;
      else lastError = `Google Calendar answered ${res.status}.`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (pushed === 0 && events.length > 0) return { ok: false, reason: "failed", message: lastError || "Nothing was pushed." };
  return { ok: true, pushed };
}
