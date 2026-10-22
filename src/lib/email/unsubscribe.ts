import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-click unsubscribe for non-essential mail (the weekly digest, deadline reminders, and "draft ready").
 * The link carries the address, the workspace, and the kind of mail, signed with EMAIL_SIGNING_SECRET
 * (falling back to CRON_SECRET), so nobody can unsubscribe someone else.
 */
export type MailCategory = "digest" | "reminders" | "drafts";
export const MAIL_CATEGORIES: Record<MailCategory, string> = {
  digest: "the weekly digest",
  reminders: "deadline reminders",
  drafts: "draft ready emails",
};

function secret(): string | null {
  return process.env.EMAIL_SIGNING_SECRET?.trim() || process.env.CRON_SECRET?.trim() || null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function unsubscribeToken(input: { email: string; orgId: string; category: MailCategory }): string | null {
  const key = secret();
  if (!key) return null;
  const body = b64(JSON.stringify([input.email.trim().toLowerCase(), input.orgId, input.category]));
  const sig = createHmac("sha256", key).update(body).digest("base64url").slice(0, 32);
  return `${body}.${sig}`;
}

export function readUnsubscribeToken(token: string): { email: string; orgId: string; category: MailCategory } | null {
  const key = secret();
  const [body, sig] = token.split(".");
  if (!key || !body || !sig) return null;
  const want = createHmac("sha256", key).update(body).digest("base64url").slice(0, 32);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const [email, orgId, category] = JSON.parse(unb64(body)) as [string, string, MailCategory];
    if (!MAIL_CATEGORIES[category]) return null;
    return { email, orgId, category };
  } catch {
    return null;
  }
}

/** The page a person clicks in the email, and the URL mail clients POST to for one-click unsubscribe. */
export function unsubscribeLinks(base: string, input: { email: string; orgId: string; category: MailCategory }): { page: string; oneClick: string } | null {
  const t = unsubscribeToken(input);
  return t ? { page: `${base}/unsubscribe?t=${t}`, oneClick: `${base}/api/email/unsubscribe?t=${t}` } : null;
}
