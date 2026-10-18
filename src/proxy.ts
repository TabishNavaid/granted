import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the Supabase session cookie fresh and sends signed-out visitors to
 * sign in. Does nothing in demo mode, where every screen runs on mock data.
 */
const PROTECTED = ["/inbox", "/opportunities", "/applications", "/pipeline", "/calendar", "/outreach", "/profile", "/activity", "/settings", "/connections", "/social", "/onboarding"];

function demo() {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  const keys = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return !keys;
  return !keys;
}

export async function proxy(request: NextRequest) {
  if (demo()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const needsUser = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (!user && needsUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/sign-in" || path === "/sign-up")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inbox";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|images|.*\\.(?:png|jpg|jpeg|svg|webp|css|js|map)$).*)"],
};
