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
}

export type SendResult = { ok: true; id: string } | { ok: false; reason: "not_connected" | "failed"; message: string };

export function emailConnected() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function contactAddress(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
}

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, reason: "not_connected", message: "Email delivery is not set up yet." };
  const from = process.env.EMAIL_FROM?.trim() || "onboarding@resend.dev";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html, reply_to: msg.replyTo }),
    });
    if (!res.ok) return { ok: false, reason: "failed", message: `Resend answered ${res.status}.` };
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "" };
  } catch (err) {
    return { ok: false, reason: "failed", message: err instanceof Error ? err.message : String(err) };
  }
}
