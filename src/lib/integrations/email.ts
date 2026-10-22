import { DEFAULT_EMAIL_FROM, EMAIL } from "@/lib/brand";

/**
 * Transactional email through Resend. Without RESEND_API_KEY every send
 * returns { ok: false, reason: "not_connected" } and callers show a copy
 * path instead. Nothing here sends to a funder: that stays with the user.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** One-click unsubscribe (RFC 8058) for non-essential mail. Adds List-Unsubscribe headers. */
  unsubscribeUrl?: string | null;
  /** Resend tags, for filtering in its dashboard: e.g. [{ name: "category", value: "digest" }]. */
  tags?: { name: string; value: string }[];
}

export type SendResult = { ok: true; id: string } | { ok: false; reason: "not_connected" | "failed"; message: string };

export function emailConnected() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Where the contact form delivers and the address the site shows. */
export function contactAddress(): string {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || EMAIL.hello;
}

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not_connected", message: "Email delivery is not set up yet." };
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        reply_to: msg.replyTo ?? EMAIL.support,
        headers: msg.unsubscribeUrl ? { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
        tags: msg.tags,
      }),
    });
    if (!res.ok) return { ok: false, reason: "failed", message: `Resend answered ${res.status}.` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    return { ok: false, reason: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
