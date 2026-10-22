import { NextResponse, type NextRequest } from "next/server";
import { readUnsubscribeToken } from "@/lib/email/unsubscribe";
import { hasSupabase } from "@/lib/env";

/** One-click unsubscribe (RFC 8058): mail clients POST here straight from the List-Unsubscribe header. */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const who = readUnsubscribeToken(token);
  if (!who) return NextResponse.json({ ok: false, error: "That unsubscribe link is not valid." }, { status: 400 });
  if (!hasSupabase()) return NextResponse.json({ ok: true });
  const { optOut } = await import("@/lib/email/opt-outs");
  const ok = await optOut(who);
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
}
