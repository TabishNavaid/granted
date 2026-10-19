import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";

/**
 * Opens one of the demo's sample workspaces and goes to a page in it, so a
 * link can say "see the sample firm's bids". Demo only; anywhere else it
 * goes to the Inbox. `next` must be a path on this site.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sample = url.searchParams.get("sample") ?? "";
  const raw = url.searchParams.get("next") ?? "/inbox";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inbox";
  if (!isDemoMode()) return NextResponse.redirect(new URL("/inbox", url));
  // With no keys the workspaces live in the visitor's browser, so the browser opens the sample.
  if (replayActive()) return NextResponse.redirect(new URL(`/demo/open?sample=${encodeURIComponent(sample)}&next=${encodeURIComponent(next)}`, url));
  const [{ DEMO_COOKIE, runInSession }, { sampleById }, { mockServices }] = await Promise.all([import("@/lib/services/demo-session"), import("@/lib/mock/samples"), import("@/lib/services/mock")]);
  if (!sampleById(sample)) return NextResponse.redirect(new URL(next, url));
  await runInSession(request.cookies.get(DEMO_COOKIE)?.value, () => mockServices.org.switchWorkspace(sample));
  return NextResponse.redirect(new URL(next, url));
}
