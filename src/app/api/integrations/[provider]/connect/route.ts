import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { currentOrg } from "@/lib/integrations/current-org";
import { authorizeUrl, callbackUrl, isProvider, isPurpose, purposesFor, providerConnected } from "@/lib/integrations/oauth";
import { connectionStore } from "@/lib/integrations/store";

const SITE = siteUrl();
const settings = (query: Record<string, string>) => NextResponse.redirect(`${SITE}/settings/integrations?${new URLSearchParams(query)}`, 302);

/** Starts the OAuth dance for a provider. The browser lands here from a "Connect" link and leaves for the provider. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  if (!providerConnected(provider)) return settings({ error: "not_connected", provider });

  const org = await currentOrg();
  if (!org) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const allowed = purposesFor(provider);
  const requested = request.nextUrl.searchParams.get("purpose") ?? "";
  const purpose = isPurpose(requested) && allowed.includes(requested) ? requested : allowed[0];

  const existing = await connectionStore().get(org.orgId, provider);
  const r = authorizeUrl({ provider, purpose, orgId: org.orgId, existingScopes: existing?.scopes ?? [], redirectUri: callbackUrl(provider) });
  if (!r.ok) return settings({ error: "not_connected", provider });
  return NextResponse.redirect(r.url, 302);
}
