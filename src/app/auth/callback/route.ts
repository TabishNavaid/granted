import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/supabase/clients";

/** Where the magic link lands. Exchanges the code for a session, then continues to the app. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/inbox";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/inbox";
  const supabase = await createUserClient();
  let error: string | null = null;
  if (code) {
    const r = await supabase.auth.exchangeCodeForSession(code);
    error = r.error?.message ?? null;
  } else if (tokenHash && type) {
    const r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "email" | "signup" });
    error = r.error?.message ?? null;
  } else {
    error = "The link is missing its code.";
  }
  if (error) {
    const dest = url.clone();
    dest.pathname = "/sign-in";
    dest.search = "";
    dest.searchParams.set("error", "That sign-in link did not work. It may have expired. Ask for a new one.");
    return NextResponse.redirect(dest);
  }
  const dest = url.clone();
  dest.pathname = safeNext;
  dest.search = "";
  return NextResponse.redirect(dest);
}
