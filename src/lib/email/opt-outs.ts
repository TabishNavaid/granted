import type { MailCategory } from "./unsubscribe";

/** Record an opt-out. Server only (the table has no user policies). */
export async function optOut(input: { email: string; orgId: string; category: MailCategory }): Promise<boolean> {
  const { adminClient } = await import("@/lib/supabase/clients");
  const { error } = await adminClient().from("email_opt_outs").upsert({ email: input.email.toLowerCase(), org_id: input.orgId, category: input.category }, { onConflict: "email,org_id,category" });
  return !error;
}

/** Addresses in a workspace that opted out of a kind of mail. */
export async function optedOut(orgId: string, category: MailCategory): Promise<Set<string>> {
  const { adminClient } = await import("@/lib/supabase/clients");
  const { data } = await adminClient().from("email_opt_outs").select("email").eq("org_id", orgId).eq("category", category);
  return new Set((data ?? []).map((r) => String(r.email).toLowerCase()));
}
