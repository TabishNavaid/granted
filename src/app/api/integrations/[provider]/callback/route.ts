import { NextResponse, type NextRequest } from "next/server";
import { accountEmail, callbackUrl, exchangeCode, isProvider, mergeScopes, parseState } from "@/lib/integrations/oauth";
import { connectionStore } from "@/lib/integrations/store";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const settings = (query: Record<string, string>) => NextResponse.redirect(`${SITE}/settings/integrations?${new URLSearchParams(query)}`, 302);

/** Where the provider sends the user back. The signed state carries the org, so no session lookup is needed. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });

  const q = request.nextUrl.searchParams;
  const code = q.get("code");
  const state = parseState(q.get("state") ?? "");
  if (q.get("error") || !code || !state || state.provider !== provider) return settings({ error: "denied", provider });

  const tokens = await exchangeCode(provider, code, callbackUrl(provider));
  if (!tokens.ok) return settings({ error: "failed", provider });

  const store = connectionStore();
  const [email, existing] = await Promise.all([accountEmail(provider, tokens.accessToken), store.get(state.orgId, provider)]);
  await store.upsert({
    orgId: state.orgId,
    provider,
    accountEmail: email || existing?.accountEmail || "",
    scopes: mergeScopes(existing?.scopes, tokens.scopes),
    accessToken: tokens.accessToken,
    // Google only hands out a refresh token on a fresh consent, so keep the one we already have.
    refreshToken: tokens.refreshToken ?? existing?.refreshToken ?? null,
    expiresAt: tokens.expiresAt,
  });
  return settings({ connected: provider });
}
