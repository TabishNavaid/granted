import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, hasAi } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import { currentOrg } from "@/lib/integrations/current-org";
import { fileToText } from "@/lib/loop/documents";
import type { Document } from "@/lib/types";
import type { ParsedUpload } from "@/lib/demo/upload";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024;
const NO_MODEL = "No model key, so no facts were read from it yet.";

/**
 * Upload a document, read its text, store it, and (with a model key) turn it
 * into facts waiting for review. In the demo with no keys the workspaces live
 * in the visitor's browser, so this only reads the file and returns it; the
 * browser keeps it.
 */
export async function POST(request: NextRequest) {
  if (replayActive()) {
    const read = await readUpload(request);
    return "error" in read ? read.error : NextResponse.json({ ok: true, parsed: read.parsed, extraction: { ok: false, error: NO_MODEL } });
  }
  if (!isDemoMode()) return handle(request);
  const { DEMO_COOKIE, runInSession } = await import("@/lib/services/demo-session");
  return runInSession(request.cookies.get(DEMO_COOKIE)?.value, () => handle(request));
}

async function readUpload(request: NextRequest): Promise<{ parsed: ParsedUpload; buffer: Buffer } | { error: NextResponse }> {
  const fail = (error: string) => ({ error: NextResponse.json({ ok: false, error }, { status: 400 }) });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const type = String(form?.get("type") ?? "other");
  if (!(file instanceof File)) return fail("Choose a file first.");
  if (file.size > MAX_BYTES) return fail("That file is over 25 MB. Try a smaller one.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await fileToText(buffer, file.type, file.name);
  if (!text.ok) return fail(text.message);
  const parsed: ParsedUpload = { type: type as Document["type"], title: file.name.replace(/\.[^.]+$/, ""), fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, pageCount: text.pages, text: text.text, pages: null };
  return { parsed, buffer };
}

async function handle(request: NextRequest) {
  const who = await currentOrg();
  if (!who) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const read = await readUpload(request);
  if ("error" in read) return read.error;
  const { parsed, buffer } = read;

  let doc: Document;
  if (isDemoMode()) {
    const { state, newId, now } = await import("@/lib/services/mock");
    doc = { id: newId("doc"), orgId: state.org.id, type: parsed.type, title: parsed.title, fileName: parsed.fileName, mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes, status: "ready", pageCount: parsed.pageCount, factCount: 0, uploadedAt: now() };
    state.documents.unshift(doc);
    state.documentTexts[doc.id] = parsed.text;
  } else {
    const { adminClient } = await import("@/lib/supabase/clients");
    const { map } = await import("@/lib/services/supabase");
    const db = adminClient();
    const path = `${who.orgId}/${Date.now()}-${parsed.fileName.replace(/[^\w.-]+/g, "_")}`;
    const up = await db.storage.from("documents").upload(path, buffer, { contentType: parsed.mimeType, upsert: false });
    if (up.error) return NextResponse.json({ ok: false, error: `We could not store the file: ${up.error.message}` }, { status: 500 });
    const { data, error } = await db.from("documents").insert({ org_id: who.orgId, type: parsed.type, title: parsed.title, file_name: parsed.fileName, storage_path: path, mime_type: parsed.mimeType, size_bytes: parsed.sizeBytes, status: "ready", page_count: parsed.pageCount, extracted_text: parsed.text }).select("*").single();
    if (error || !data) return NextResponse.json({ ok: false, error: "We stored the file but could not record it. Try again." }, { status: 500 });
    doc = map.document(data);
  }

  let extraction: { ok: boolean; factCount?: number; error?: string } = { ok: false, error: NO_MODEL };
  if (hasAi()) {
    const { extractDocumentFacts } = await import("@/lib/loop/features");
    const store = isDemoMode() ? (await import("@/lib/loop/memory-store")).memoryStore : (await import("@/lib/loop/supabase-store")).makeSupabaseStore({ orgId: who.orgId, userId: "", email: who.email, fullName: who.fullName });
    const r = await extractDocumentFacts(store, doc.id);
    extraction = r.ok ? { ok: true, factCount: r.data.factCount } : { ok: false, error: r.error };
    if (r.ok) doc.factCount = r.data.factCount;
  }
  return NextResponse.json({ ok: true, document: doc, extraction });
}
