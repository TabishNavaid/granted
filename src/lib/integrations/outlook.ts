import type { OutgoingMessage, ProviderSendResult } from "@/lib/integrations/gmail";
import { freshAccessToken } from "@/lib/integrations/oauth";

export async function sendOutlook(orgId: string, msg: OutgoingMessage): Promise<ProviderSendResult> {
  const token = await freshAccessToken(orgId, "microsoft");
  if (!token.ok) return { ok: false, reason: "not_connected", message: token.message };
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: msg.subject,
          body: { contentType: "Text", content: msg.text },
          toRecipients: [{ emailAddress: { address: msg.to } }],
        },
        saveToSentItems: true,
      }),
    });
    if (!res.ok) return { ok: false, reason: "failed", message: `Outlook answered ${res.status}.` };
    // Graph answers 202 with an empty body, so there is no message id to hand back.
    return { ok: true, id: res.headers.get("request-id") ?? "" };
  } catch (err) {
    return { ok: false, reason: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
