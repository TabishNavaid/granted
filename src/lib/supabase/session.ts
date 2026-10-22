import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { adminClient, createUserClient } from "./clients";

const ACTIVE_ORG_COOKIE = "ff_org";

/** Remember which organization a consultant has open. Checked against memberships on every request. */
export async function setActiveOrg(orgId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

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

/**
 * A background job runs as the person who started it, after their request has ended, so there are no
 * cookies to read. The job runner sets the session here for the length of the job.
 */
const override = new AsyncLocalStorage<SessionContext>();

export function runAsSession<T>(session: SessionContext, fn: () => Promise<T>): Promise<T> {
  return override.run(session, fn);
}

/** The signed-in user and their organization. Creates the organization on first sign-in. */
export async function getSession(): Promise<SessionContext | null> {
  const fixed = override.getStore();
  if (fixed) return fixed;
  const supa = await createUserClient();
  const { data } = await supa.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const db = adminClient();
  const email = user.email ?? "";
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
  await db.from("profiles").upsert({ id: user.id, email, full_name: fullName || null }, { onConflict: "id" });
  // An invite to this address becomes a membership the first time its owner signs in.
  if (email) await db.from("org_members").update({ user_id: user.id, status: "active" }).is("user_id", null).eq("status", "invited").ilike("invited_email", email);
  const { data: memberships } = await db.from("org_members").select("org_id").eq("user_id", user.id).eq("status", "active");
  if (memberships?.length) {
    // Consultant mode: the organization chosen last, if this login still belongs to it.
    const chosen = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
    const orgId = (memberships.find((m) => m.org_id === chosen) ?? memberships[0]).org_id as string;
    return { userId: user.id, email, fullName, orgId };
  }

  // First sign-in: make the workspace.
  const orgName = ((user.user_metadata?.org_name as string | undefined) ?? "").trim() || (email.split("@")[1] ?? "Your organization");
  const { data: org, error } = await db.from("organizations").insert({ name: orgName, onboarding_step: "start" }).select("id").single();
  if (error || !org) throw new Error(`Could not create the organization: ${error?.message}`);
  await db.from("org_members").insert({ org_id: org.id, user_id: user.id, invited_email: email, role: "owner", status: "active" });
  await db.from("notification_settings").insert({ org_id: org.id });
  return { userId: user.id, email, fullName, orgId: org.id as string };
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new NotSignedIn();
  return s;
}
