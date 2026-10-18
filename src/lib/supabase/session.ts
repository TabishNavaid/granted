import { adminClient, createUserClient } from "./clients";

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string;
  orgId: string;
}

export class NotSignedIn extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedIn";
  }
}

/** The signed-in user and their organization. Creates the organization on first sign-in. */
export async function getSession(): Promise<SessionContext | null> {
  const supa = await createUserClient();
  const { data } = await supa.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const db = adminClient();
  const email = user.email ?? "";
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
  await db.from("profiles").upsert({ id: user.id, email, full_name: fullName || null }, { onConflict: "id" });
  const { data: membership } = await db.from("org_members").select("org_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (membership?.org_id) return { userId: user.id, email, fullName, orgId: membership.org_id as string };

  // First sign-in: make the workspace.
  const orgName = ((user.user_metadata?.org_name as string | undefined) ?? "").trim() || (email.split("@")[1] ?? "Your organization");
  const { data: org, error } = await db.from("organizations").insert({ name: orgName, onboarding_step: "start" }).select("id").single();
  if (error || !org) throw new Error(`Could not create the organization: ${error?.message}`);
  await db.from("org_members").insert({ org_id: org.id, user_id: user.id, invited_email: email, role: "owner", status: "active" });
  await db.from("subscriptions").insert({ org_id: org.id, plan: "free", status: "active", seats: 1 });
  await db.from("notification_settings").insert({ org_id: org.id });
  return { userId: user.id, email, fullName, orgId: org.id as string };
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new NotSignedIn();
  return s;
}
