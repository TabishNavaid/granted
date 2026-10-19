import { isDemoMode } from "@/lib/env";

/** The org and user behind a request, for route handlers that cannot go through the services proxy. */
export async function currentOrg(): Promise<{ orgId: string; email: string; fullName: string } | null> {
  if (isDemoMode()) {
    const { state } = await import("@/lib/services/mock");
    const { CURRENT_USER_ID } = await import("@/lib/mock/data");
    const me = state.members.find((m) => m.id === CURRENT_USER_ID);
    return { orgId: state.org.id, email: me?.email ?? "", fullName: me?.fullName ?? "" };
  }
  const { getSession } = await import("@/lib/supabase/session");
  const s = await getSession();
  return s ? { orgId: s.orgId, email: s.email, fullName: s.fullName } : null;
}
