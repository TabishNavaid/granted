import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, hasAi } from "@/lib/env";
import { currentOrg } from "@/lib/integrations/current-org";
import { fileToText } from "@/lib/loop/documents";
import type { Document } from "@/lib/types";

export const runtime = "nodejs";
const MAX_BYTES = 25 * 1024 * 1024;

/** Upload a document, read its text, store it, and (with a model key) turn it into facts waiting for review. */
export async function POST(request: NextRequest) {
  const who = await currentOrg();
  if (!who) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const type = String(form?.get("type") ?? "other");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "That file is over 25 MB. Try a smaller one." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await fileToText(buffer, file.type, file.name);
  if (!text.ok) return NextResponse.json({ ok: false, error: text.message }, { status: 400 });

  let doc: Document;
  if (isDemoMode()) {
    const { state, newId, now } = await import("@/lib/services/mock");
    doc = { id: newId("doc"), orgId: state.org.id, type: type as Document["type"], title: file.name.replace(/\.[^.]+$/, ""), fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, status: "ready", pageCount: text.pages, factCount: 0, uploadedAt: now() };
    state.documents.unshift(doc);
    state.documentTexts[doc.id] = text.text;
  } else {
    const { adminClient } = await import("@/lib/supabase/clients");
    const { map } = await import("@/lib/services/supabase");
    const db = adminClient();
    const path = `${who.orgId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await db.storage.from("documents").upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (up.error) return NextResponse.json({ ok: false, error: `We could not store the file: ${up.error.message}` }, { status: 500 });
    const { data, error } = await db.from("documents").insert({ org_id: who.orgId, type, title: file.name.replace(/\.[^.]+$/, ""), file_name: file.name, storage_path: path, mime_type: file.type || "application/octet-stream", size_bytes: file.size, status: "ready", page_count: text.pages, extracted_text: text.text }).select("*").single();
    if (error || !data) return NextResponse.json({ ok: false, error: "We stored the file but could not record it. Try again." }, { status: 500 });
    doc = map.document(data);
  }

  let extraction: { ok: boolean; factCount?: number; error?: string } = { ok: false, error: "No model key, so no facts were read from it yet." };
  if (hasAi()) {
    const { extractDocumentFacts } = await import("@/lib/loop/features");
    const store = isDemoMode() ? (await import("@/lib/loop/memory-store")).memoryStore : (await import("@/lib/loop/supabase-store")).makeSupabaseStore({ orgId: who.orgId, userId: "", email: who.email, fullName: who.fullName });
    const r = await extractDocumentFacts(store, doc.id);
    extraction = r.ok ? { ok: true, factCount: r.data.factCount } : { ok: false, error: r.error };
    if (r.ok) doc.factCount = r.data.factCount;
  }
  return NextResponse.json({ ok: true, document: doc, extraction });
}
