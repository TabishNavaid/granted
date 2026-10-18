import { freshAccessToken } from "@/lib/integrations/oauth";

export interface OutgoingMessage {
  to: string;
  subject: string;
  text: string;
}

export type ProviderSendResult = { ok: true; id: string } | { ok: false; reason: "not_connected" | "failed"; message: string };

const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);
const headerSafe = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** RFC 2047 encoded word when the header has characters outside printable ASCII. */
function encodeHeader(value: string): string {
  const v = headerSafe(value);
  return isAscii(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

/** The raw RFC 2822 message Gmail expects. From is omitted so Gmail fills in the connected account. */
export function buildRawMessage(msg: OutgoingMessage): string {
  const body = Buffer.from(msg.text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const lines = [
    `To: ${headerSafe(msg.to)}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export async function sendGmail(orgId: string, msg: OutgoingMessage): Promise<ProviderSendResult> {
  const token = await freshAccessToken(orgId, "google");
  if (!token.ok) return { ok: false, reason: "not_connected", message: token.message };
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: buildRawMessage(msg) }),
    });
    if (!res.ok) return { ok: false, reason: "failed", message: `Gmail answered ${res.status}.` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    return { ok: false, reason: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
