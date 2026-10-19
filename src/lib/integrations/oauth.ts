import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/site-url";
import { connectionStore } from "@/lib/integrations/store";

/**
 * OAuth for the user-owned accounts (Google for Gmail and Calendar, Microsoft
 * for Outlook). One connection per provider per org; connecting a second
 * purpose asks for the union of scopes so the same Google grant covers both.
 * Tokens are read and written only through the connection store.
 */
export type Provider = "google" | "microsoft";
export type Purpose = "gmail" | "calendar" | "outlook";

export interface OAuthState {
  orgId: string;
  provider: Provider;
  purpose: Purpose;
  nonce: string;
  ts: number;
}

export type TokenResult = { ok: true; accessToken: string; refreshToken: string | null; expiresAt: string | null; scopes: string[] } | { ok: false; message: string };

const STATE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_LEEWAY_MS = 60 * 1000;

const ENDPOINTS: Record<Provider, { authorize: string; token: string; me: string }> = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    me: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
  microsoft: {
    authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    me: "https://graph.microsoft.com/v1.0/me",
  },
};

const SCOPES: Record<Purpose, string[]> = {
  gmail: ["https://www.googleapis.com/auth/gmail.send", "openid", "email"],
  calendar: ["https://www.googleapis.com/auth/calendar.events", "openid", "email"],
  outlook: ["offline_access", "User.Read", "Mail.Send"],
};

export function isProvider(value: string): value is Provider {
  return value === "google" || value === "microsoft";
}

export function isPurpose(value: string): value is Purpose {
  return value === "gmail" || value === "calendar" || value === "outlook";
}

export function purposesFor(provider: Provider): Purpose[] {
  return provider === "google" ? ["gmail", "calendar"] : ["outlook"];
}

export function providerName(provider: Provider): string {
  return provider === "google" ? "Google" : "Microsoft";
}

function credentials(provider: Provider): { id: string; secret: string } | null {
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  const id = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const secret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  return id && secret ? { id, secret } : null;
}

export function providerConnected(provider: Provider): boolean {
  return credentials(provider) !== null;
}

export function scopesFor(provider: Provider, purpose: Purpose): string[] {
  return purposesFor(provider).includes(purpose) ? [...SCOPES[purpose]] : [];
}

export function mergeScopes(...lists: (string[] | undefined)[]): string[] {
  return [...new Set(lists.flat().filter((s): s is string => Boolean(s)))];
}

/** Where the provider sends the user back. This exact URL must be registered with the provider. */
export function callbackUrl(provider: Provider): string {
  const base = siteUrl();
  return `${base}/api/integrations/${provider}/callback`;
}

// ---------- Signed state ----------

const b64url = (buf: Buffer) => buf.toString("base64url");

function stateSecret(provider: Provider): Buffer | null {
  const creds = credentials(provider);
  // Derived rather than used directly so the client secret itself never signs anything.
  return creds ? createHash("sha256").update(`granted-oauth-state:${creds.secret}`).digest() : null;
}

function signState(provider: Provider, payload: string): string | null {
  const secret = stateSecret(provider);
  return secret ? b64url(createHmac("sha256", secret).update(payload).digest()) : null;
}

export function parseState(state: string): OAuthState | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.orgId !== "string" || typeof o.provider !== "string" || typeof o.purpose !== "string" || typeof o.nonce !== "string" || typeof o.ts !== "number") return null;
  if (!isProvider(o.provider) || !isPurpose(o.purpose)) return null;
  const expected = signState(o.provider, payload);
  if (!expected) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() - o.ts > STATE_MAX_AGE_MS || o.ts > Date.now() + 60_000) return null;
  return { orgId: o.orgId, provider: o.provider, purpose: o.purpose, nonce: o.nonce, ts: o.ts };
}

// ---------- Authorize ----------

export function authorizeUrl(input: { provider: Provider; purpose: Purpose; orgId: string; existingScopes: string[]; redirectUri: string }): { ok: true; url: string; state: string } | { ok: false; message: string } {
  const { provider, purpose, orgId, existingScopes, redirectUri } = input;
  const creds = credentials(provider);
  if (!creds) return { ok: false, message: `${providerName(provider)} is not set up on this server yet.` };
  const wanted = scopesFor(provider, purpose);
  if (wanted.length === 0) return { ok: false, message: `${providerName(provider)} cannot be used for ${purpose}.` };
  const scopes = mergeScopes(existingScopes, wanted);

  const payload = b64url(Buffer.from(JSON.stringify({ orgId, provider, purpose, nonce: b64url(randomBytes(16)), ts: Date.now() } satisfies OAuthState)));
  const sig = signState(provider, payload);
  if (!sig) return { ok: false, message: `${providerName(provider)} is not set up on this server yet.` };
  const state = `${payload}.${sig}`;

  const url = new URL(ENDPOINTS[provider].authorize);
  url.searchParams.set("client_id", creds.id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  } else {
    url.searchParams.set("response_mode", "query");
  }
  return { ok: true, url: url.toString(), state };
}

// ---------- Tokens ----------

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(provider: Provider, form: Record<string, string>): Promise<TokenResult> {
  const creds = credentials(provider);
  if (!creds) return { ok: false, message: `${providerName(provider)} is not set up on this server yet.` };
  try {
    const res = await fetch(ENDPOINTS[provider].token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ ...form, client_id: creds.id, client_secret: creds.secret }).toString(),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !data.access_token) {
      return { ok: false, message: data.error_description || data.error || `${providerName(provider)} answered ${res.status}.` };
    }
    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: typeof data.expires_in === "number" ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      scopes: (data.scope ?? "").split(/\s+/).filter(Boolean),
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export function exchangeCode(provider: Provider, code: string, redirectUri: string): Promise<TokenResult> {
  return postToken(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export async function accountEmail(provider: Provider, accessToken: string): Promise<string> {
  try {
    const res = await fetch(ENDPOINTS[provider].me, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return "";
    const data = (await res.json()) as { email?: string; mail?: string | null; userPrincipalName?: string };
    const email = provider === "google" ? data.email : data.mail || data.userPrincipalName;
    return typeof email === "string" ? email : "";
  } catch {
    return "";
  }
}

export async function freshAccessToken(orgId: string, provider: Provider): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const store = connectionStore();
  const conn = await store.get(orgId, provider);
  if (!conn) return { ok: false, message: `Connect your ${providerName(provider)} account first.` };
  const expiring = conn.expiresAt !== null && new Date(conn.expiresAt).getTime() - Date.now() < REFRESH_LEEWAY_MS;
  if (!expiring) return { ok: true, token: conn.accessToken };
  if (!conn.refreshToken) return { ok: false, message: `Your ${providerName(provider)} connection expired. Connect it again.` };
  const r = await postToken(provider, { grant_type: "refresh_token", refresh_token: conn.refreshToken });
  if (!r.ok) return { ok: false, message: `Could not refresh your ${providerName(provider)} connection. ${r.message}` };
  await store.updateTokens(orgId, provider, { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: r.expiresAt });
  return { ok: true, token: r.accessToken };
}
