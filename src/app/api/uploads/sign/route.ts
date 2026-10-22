import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, isDemoMode } from "@/lib/env";

/**
 * A one-time upload URL for the signed-in workspace's own folder in the private documents bucket.
 * The browser sends the file straight to storage, so Vercel's 4.5 MB request limit never applies;
 * the upload route then reads the stored file and extracts its text. Owners and editors only.
 */
export const runtime = "nodejs";
const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx|txt|md|csv|xlsx|png|jpe?g|webp)$/i;

export async function POST(request: NextRequest) {
  if (isDemoMode() || !hasSupabase()) return NextResponse.json({ mode: "form" });
  const body = (await request.json().catch(() => null)) as { fileName?: string; sizeBytes?: number } | null;
  const fileName = String(body?.fileName ?? "").trim();
  const size = Number(body?.sizeBytes ?? 0);
  if (!fileName || !ALLOWED.test(fileName)) return NextResponse.json({ ok: false, error: "We can store PDF, Word (.docx), text, CSV, Excel, and image files." }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Files can be up to 100 MB." }, { status: 400 });
  const { getSession } = await import("@/lib/supabase/session");
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { adminClient } = await import("@/lib/supabase/clients");
  const db = adminClient();
  const { data: me } = await db.from("org_members").select("role").eq("org_id", session.orgId).eq("user_id", session.userId).maybeSingle();
  if (!me || me.role === "reviewer") return NextResponse.json({ ok: false, error: "Board reviewers can read documents but cannot add them." }, { status: 403 });
  const path = `${session.orgId}/${randomUUID()}-${fileName.replace(/[^\w.-]+/g, "_").slice(-120)}`;
  const { data, error } = await db.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ ok: false, error: `Storage would not take the file: ${error?.message ?? "no URL"}` }, { status: 500 });
  return NextResponse.json({ mode: "direct", path, signedUrl: data.signedUrl, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
}
