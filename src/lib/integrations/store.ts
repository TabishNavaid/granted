import type { IntegrationConnection } from "@/lib/types";

/**
 * Where OAuth tokens live. Tokens never leave the server: the UI only sees
 * IntegrationConnection (provider, account, scopes, date).
 */
export interface StoredConnection extends IntegrationConnection {
  accessToken: string;
  refreshToken: string | null;
  /** ISO time the access token expires, if the provider said. */
  expiresAt: string | null;
}

export interface ConnectionStore {
  list(orgId: string): Promise<StoredConnection[]>;
  get(orgId: string, provider: "google" | "microsoft"): Promise<StoredConnection | null>;
  upsert(conn: Omit<StoredConnection, "id" | "connectedAt">): Promise<StoredConnection>;
  updateTokens(orgId: string, provider: "google" | "microsoft", tokens: { accessToken: string; refreshToken?: string | null; expiresAt: string | null }): Promise<void>;
  remove(orgId: string, provider: "google" | "microsoft"): Promise<void>;
}

export function publicView(c: StoredConnection): IntegrationConnection {
  return { id: c.id, orgId: c.orgId, provider: c.provider, accountEmail: c.accountEmail, scopes: c.scopes, connectedAt: c.connectedAt };
}

// ---------- In-memory (demo) ----------
const mem = new Map<string, StoredConnection>();
const key = (orgId: string, provider: string) => `${orgId}:${provider}`;

export const memoryConnectionStore: ConnectionStore = {
  async list(orgId) {
    return [...mem.values()].filter((c) => c.orgId === orgId);
  },
  async get(orgId, provider) {
    return mem.get(key(orgId, provider)) ?? null;
  },
  async upsert(conn) {
    const existing = mem.get(key(conn.orgId, conn.provider));
    const next: StoredConnection = { ...conn, id: existing?.id ?? `conn_${Math.random().toString(36).slice(2)}`, connectedAt: new Date().toISOString() };
    mem.set(key(conn.orgId, conn.provider), next);
    return next;
  },
  async updateTokens(orgId, provider, tokens) {
    const c = mem.get(key(orgId, provider));
    if (c) Object.assign(c, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? c.refreshToken, expiresAt: tokens.expiresAt });
  },
  async remove(orgId, provider) {
    mem.delete(key(orgId, provider));
  },
};

// ---------- Supabase ----------
export function supabaseConnectionStore(): ConnectionStore {
  type Row = Record<string, unknown>;
  const map = (r: Row): StoredConnection => ({
    id: String(r.id),
    orgId: String(r.org_id),
    provider: r.provider as "google" | "microsoft",
    accountEmail: String(r.account_email ?? ""),
    scopes: (r.scopes as string[]) ?? [],
    connectedAt: new Date(String(r.connected_at)).toISOString(),
    accessToken: String(r.access_token),
    refreshToken: (r.refresh_token as string | null) ?? null,
    expiresAt: r.expires_at ? new Date(String(r.expires_at)).toISOString() : null,
  });
  const db = () => {
    // Lazy so this file can be imported in demo mode without Supabase keys.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { adminClient } = require("@/lib/supabase/clients") as typeof import("@/lib/supabase/clients");
    return adminClient();
  };
  return {
    async list(orgId) {
      const { data } = await db().from("integration_connections").select("*").eq("org_id", orgId);
      return (data ?? []).map(map);
    },
    async get(orgId, provider) {
      const { data } = await db().from("integration_connections").select("*").eq("org_id", orgId).eq("provider", provider).maybeSingle();
      return data ? map(data) : null;
    },
    async upsert(conn) {
      const { data, error } = await db()
        .from("integration_connections")
        .upsert({ org_id: conn.orgId, provider: conn.provider, account_email: conn.accountEmail, scopes: conn.scopes, access_token: conn.accessToken, refresh_token: conn.refreshToken, expires_at: conn.expiresAt, connected_at: new Date().toISOString() }, { onConflict: "org_id,provider" })
        .select("*")
        .single();
      if (error || !data) throw new Error(`connection: ${error?.message}`);
      return map(data);
    },
    async updateTokens(orgId, provider, tokens) {
      const row: Row = { access_token: tokens.accessToken, expires_at: tokens.expiresAt };
      if (tokens.refreshToken) row.refresh_token = tokens.refreshToken;
      await db().from("integration_connections").update(row).eq("org_id", orgId).eq("provider", provider);
    },
    async remove(orgId, provider) {
      await db().from("integration_connections").delete().eq("org_id", orgId).eq("provider", provider);
    },
  };
}

export function connectionStore(): ConnectionStore {
  const demo = (() => {
    const flag = process.env.DEMO_MODE?.trim().toLowerCase();
    if (flag === "true" || flag === "1" || flag === "yes") return true;
    if (flag === "false" || flag === "0" || flag === "no") return false;
    return !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  })();
  return demo ? memoryConnectionStore : supabaseConnectionStore();
}
