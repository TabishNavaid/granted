import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { planFromPriceId, verifyWebhook, type StripeEvent } from "@/lib/integrations/stripe";
import { adminClient } from "@/lib/supabase/clients";

type PlanTier = "free" | "starter" | "growth";

/** What one Stripe event tells us about an organization's subscription. */
interface SubscriptionUpdate {
  plan: PlanTier;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  seats: number;
}

const SEATS: Record<PlanTier, number> = { free: 1, starter: 1, growth: 3 };

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Stripe sends customer and subscription either as an id or as an expanded object with an id. */
function idOf(v: unknown): string | null {
  return str(v) ?? str(obj(v)?.id);
}

function isoFromUnix(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;
}

function mapStatus(stripeStatus: string | null, plan: PlanTier): { plan: PlanTier; status: string } {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return { plan, status: "active" };
    case "past_due":
      return { plan, status: "past_due" };
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return { plan: "free", status: "canceled" };
    default:
      return { plan, status: stripeStatus ?? "active" };
  }
}

function fromSubscription(sub: Record<string, unknown>, deleted: boolean): SubscriptionUpdate {
  const items = obj(sub.items);
  const first = Array.isArray(items?.data) ? obj(items.data[0]) : null;
  const price = obj(first?.price);
  const plan: PlanTier = planFromPriceId(str(price?.id) ?? "") ?? "free";
  // Newer API versions moved current_period_end onto the subscription item.
  const periodEnd = isoFromUnix(sub.current_period_end) ?? isoFromUnix(first?.current_period_end);
  const mapped = deleted ? mapStatus("canceled", plan) : mapStatus(str(sub.status), plan);
  return {
    plan: mapped.plan,
    status: mapped.status,
    stripeCustomerId: idOf(sub.customer),
    stripeSubscriptionId: str(sub.id),
    currentPeriodEnd: periodEnd,
    seats: SEATS[mapped.plan],
  };
}

/**
 * Persistence. With Supabase keys the row is upserted; without them the
 * event is logged and acknowledged so Stripe stops retrying.
 */
async function persist(target: { orgId: string } | { stripeCustomerId: string }, update: SubscriptionUpdate, eventType: string): Promise<void> {
  if (!hasSupabase()) {
    console.log(`[stripe] ${eventType} received, no database configured`, { target, update });
    return;
  }
  const db = adminClient();
  const row = {
    plan: update.plan,
    status: update.status,
    stripe_customer_id: update.stripeCustomerId,
    stripe_subscription_id: update.stripeSubscriptionId,
    current_period_end: update.currentPeriodEnd,
    seats: update.seats,
  };
  if ("orgId" in target) {
    const { error } = await db.from("subscriptions").upsert({ org_id: target.orgId, ...row }, { onConflict: "org_id" });
    if (error) console.error(`[stripe] ${eventType}: could not save subscription for org ${target.orgId}`, error.message);
    return;
  }
  const { data, error } = await db.from("subscriptions").update(row).eq("stripe_customer_id", target.stripeCustomerId).select("org_id");
  if (error) console.error(`[stripe] ${eventType}: could not update subscription for customer ${target.stripeCustomerId}`, error.message);
  else if (!data || data.length === 0) console.warn(`[stripe] ${eventType}: no organization has customer ${target.stripeCustomerId}`);
}

async function handle(event: StripeEvent): Promise<void> {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const metadata = obj(object.metadata);
      const orgId = str(metadata?.org_id) ?? str(object.client_reference_id);
      const plan = str(metadata?.plan);
      if (!orgId) {
        console.warn(`[stripe] ${event.type} ${event.id} has no org_id in metadata`);
        return;
      }
      const tier: PlanTier = plan === "starter" || plan === "growth" ? plan : "free";
      await persist(
        { orgId },
        { plan: tier, status: "active", stripeCustomerId: idOf(object.customer), stripeSubscriptionId: idOf(object.subscription), currentPeriodEnd: null, seats: SEATS[tier] },
        event.type,
      );
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customerId = idOf(object.customer);
      if (!customerId) {
        console.warn(`[stripe] ${event.type} ${event.id} has no customer id`);
        return;
      }
      await persist({ stripeCustomerId: customerId }, fromSubscription(object, event.type === "customer.subscription.deleted"), event.type);
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  if (!verified.ok) return NextResponse.json({ received: false, error: verified.message }, { status: 400 });
  try {
    await handle(verified.event);
  } catch (err) {
    // A persistence failure is logged, not surfaced: Stripe would retry a non-200 and the row can be repaired by the next event.
    console.error(`[stripe] ${verified.event.type} ${verified.event.id} failed`, err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ received: true });
}
