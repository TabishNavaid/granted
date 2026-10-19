import { NextResponse, type NextRequest } from "next/server";
import { replayActive } from "@/lib/replay/active";

export const runtime = "nodejs";

// Addresses on this machine or a private network are not solicitations, and the server should not fetch them for anyone.
const PRIVATE = /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

/**
 * Reads a solicitation link for the browser demo, which cannot fetch other
 * sites itself. Returns the text page by page and keeps nothing. Anywhere
 * else the service fetches on the server, so this route is demo only.
 */
export async function POST(request: NextRequest) {
  if (!replayActive()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { url } = ((await request.json().catch(() => null)) ?? {}) as { url?: unknown };
  if (typeof url !== "string" || url.length > 2000) return NextResponse.json({ error: "That does not look like a web address." }, { status: 400 });
  let host = "";
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return NextResponse.json({ error: "That does not look like a web address." }, { status: 400 });
  }
  if (PRIVATE.test(host)) return NextResponse.json({ error: "That address is not a public web page." }, { status: 400 });
  const { linkPages } = await import("@/lib/bids/link");
  return NextResponse.json(await linkPages(url));
}
