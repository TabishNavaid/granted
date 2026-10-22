import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/errors/report";

/** Browser errors from src/instrumentation-client.ts. Small bodies only, a few per minute per visitor. */
const recent = new Map<string, number[]>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= 10) return new NextResponse(null, { status: 429 });
  recent.set(ip, [...times, now]);
  if (recent.size > 5000) recent.clear();

  const text = await request.text();
  if (text.length > 8000) return new NextResponse(null, { status: 413 });
  let body: { message?: unknown; stack?: unknown; path?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim()) return new NextResponse(null, { status: 400 });
  await reportError({
    kind: "client",
    message: body.message,
    path: typeof body.path === "string" ? body.path : null,
    detail: { stack: typeof body.stack === "string" ? body.stack.split("\n").slice(0, 6).join("\n") : undefined, userAgent: request.headers.get("user-agent")?.slice(0, 160) },
  });
  return new NextResponse(null, { status: 204 });
}
