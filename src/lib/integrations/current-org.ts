import { isDemoMode } from "@/lib/env";
import { ORG_ID } from "@/lib/mock/data";

/** The org and user behind a request, for route handlers that cannot go through the services proxy. */
export async function currentOrg(): Promise<{ orgId: string; email: string; fullName: string } | null> {
  if (isDemoMode()) return { orgId: ORG_ID, email: "dana@riverbendyouth.org", fullName: "Dana Okafor" };
  const { getSession } = await import("@/lib/supabase/session");
  const s = await getSession();
  return s ? { orgId: s.orgId, email: s.email, fullName: s.fullName } : null;
}
