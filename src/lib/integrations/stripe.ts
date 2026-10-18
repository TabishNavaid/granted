import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe through its REST API, no SDK. Without the three key env vars every
 * call returns { ok: false, message } and callers keep the Free plan working.
 * Nothing here throws: a billing hiccup should never take a screen down.
 */
export type Plan = "starter" | "growth";

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type StripeResult<T> = ({ ok: true } & T) | { ok: false; message: string };

const API = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const read = (name: string) => process.env[name]?.trim() || null;

export function stripeConnected(): boolean {
  return Boolean(read("STRIPE_SECRET_KEY") && read("STRIPE_PRICE_STARTER") && read("STRIPE_PRICE_GROWTH"));
}

function priceFor(plan: Plan): string | null {
  return plan === "starter" ? read("STRIPE_PRICE_STARTER") : read("STRIPE_PRICE_GROWTH");
}

export function planFromPriceId(priceId: string): Plan | null {
  if (priceId && priceId === read("STRIPE_PRICE_STARTER")) return "starter";
  if (priceId && priceId === read("STRIPE_PRICE_GROWTH")) return "growth";
  return null;
}

const NOT_CONNECTED = "Billing is not set up yet. Add the Stripe keys under Settings, Integrations, and try again.";

/** POST a form-encoded body to Stripe and return the parsed JSON, or a plain message. */
async function post(path: string, fields: Record<string, string>): Promise<StripeResult<{ body: Record<string, unknown> }>> {
  const key = read("STRIPE_SECRET_KEY");
  if (!key) return { ok: false, message: NOT_CONNECTED };
  const body = new URLSearchParams(fields);
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const error = json.error as { message?: string } | undefined;
      const detail = error?.message ? ` Stripe said: ${error.message}` : "";
      return { ok: false, message: `Stripe could not complete that request.${detail}` };
    }
    return { ok: true, body: json };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `We could not reach Stripe. Check your connection and try again. (${detail})` };
  }
}

function urlFrom(body: Record<string, unknown>, what: string): StripeResult<{ url: string }> {
  const url = body.url;
  if (typeof url !== "string" || !url) return { ok: false, message: `Stripe did not return a ${what} link. Try again in a moment.` };
  return { ok: true, url };
}

export async function createCheckoutSession(input: {
  orgId: string;
  email: string;
  plan: Plan;
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeResult<{ url: string }>> {
  if (!stripeConnected()) return { ok: false, message: NOT_CONNECTED };
  const price = priceFor(input.plan);
  if (!price) return { ok: false, message: `The ${input.plan === "starter" ? "Starter" : "Growth"} plan has no price set up yet.` };
  const fields: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: input.orgId,
    "metadata[org_id]": input.orgId,
    "metadata[plan]": input.plan,
    allow_promotion_codes: "true",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
  if (input.customerId) fields.customer = input.customerId;
  else fields.customer_email = input.email;
  const r = await post("/checkout/sessions", fields);
  if (!r.ok) return r;
  return urlFrom(r.body, "checkout");
}

export async function createPortalSession(input: { customerId: string; returnUrl: string }): Promise<StripeResult<{ url: string }>> {
  if (!stripeConnected()) return { ok: false, message: NOT_CONNECTED };
  if (!input.customerId) return { ok: false, message: "This organization has no billing account yet. Start a paid plan first." };
  const r = await post("/billing_portal/sessions", { customer: input.customerId, return_url: input.returnUrl });
  if (!r.ok) return r;
  return urlFrom(r.body, "billing portal");
}

/**
 * Stripe signs `${timestamp}.${rawBody}` with the webhook secret. The header
 * carries `t=...,v1=...` and may list several v1 values during a secret roll.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string | null): StripeResult<{ event: StripeEvent }> {
  const secret = read("STRIPE_WEBHOOK_SECRET");
  if (!secret) return { ok: false, message: "The Stripe webhook secret is not set, so this event could not be checked." };
  if (!signatureHeader) return { ok: false, message: "The request did not carry a Stripe signature." };

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return { ok: false, message: "The Stripe signature header was not in the expected form." };

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, message: "This Stripe event is too old to trust. Stripe will retry it." };

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const matches = signatures.some((sig) => {
    const buf = Buffer.from(sig, "utf8");
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
  if (!matches) return { ok: false, message: "The Stripe signature did not match. Check STRIPE_WEBHOOK_SECRET." };

  try {
    const parsed = JSON.parse(rawBody) as Partial<StripeEvent>;
    if (typeof parsed.id !== "string" || typeof parsed.type !== "string" || !parsed.data || typeof parsed.data.object !== "object" || parsed.data.object === null) {
      return { ok: false, message: "The Stripe event was signed but not in the shape we expected." };
    }
    return { ok: true, event: { id: parsed.id, type: parsed.type, data: { object: parsed.data.object as Record<string, unknown> } } };
  } catch {
    return { ok: false, message: "The Stripe event body was not valid JSON." };
  }
}
