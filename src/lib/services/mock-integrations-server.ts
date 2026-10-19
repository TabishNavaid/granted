import type { IntegrationConnection } from "@/lib/types";
import type { CalendarEventInput, PushResult } from "@/lib/integrations/google-calendar";

/**
 * Account connections for the in-memory adapter on a server (the demo with
 * a model key). OAuth tokens never leave the server, so the browser demo has
 * no connections; ./server.ts registers this module with ./mock.ts.
 */
export async function connections(orgId: string): Promise<IntegrationConnection[]> {
  const { connectionStore, publicView } = await import("@/lib/integrations/store");
  return (await connectionStore().list(orgId)).map(publicView);
}

export async function providerReady(provider: "google" | "microsoft"): Promise<boolean> {
  const { providerConnected } = await import("@/lib/integrations/oauth");
  return providerConnected(provider);
}

export async function disconnect(orgId: string, provider: "google" | "microsoft"): Promise<void> {
  const { connectionStore } = await import("@/lib/integrations/store");
  await connectionStore().remove(orgId, provider);
}

export async function pushEvents(orgId: string, events: CalendarEventInput[]): Promise<PushResult> {
  const { pushEvents: push } = await import("@/lib/integrations/google-calendar");
  return push(orgId, events);
}

export async function sendEmail(orgId: string, via: "gmail" | "outlook", msg: { to: string; subject: string; text: string }) {
  if (via === "gmail") return (await import("@/lib/integrations/gmail")).sendGmail(orgId, msg);
  return (await import("@/lib/integrations/outlook")).sendOutlook(orgId, msg);
}
