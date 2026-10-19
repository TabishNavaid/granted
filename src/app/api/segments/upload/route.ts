import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { replayActive } from "@/lib/replay/active";
import { currentOrg } from "@/lib/integrations/current-org";
import { fileToText } from "@/lib/loop/documents";
import type { Document } from "@/lib/types";
import type { ParsedUpload } from "@/lib/demo/upload";

export const runtime = "nodejs";
const MAX_BYTES = 40 * 1024 * 1024;
const TYPES = new Set(["rfp", "addendum", "resume"]);

/**
 * Upload a solicitation, an addendum, or a résumé. PDFs keep their text page
 * by page so each requirement can cite its page. Returns the document id the
 * client then passes to bids.addRfp, bids.addAddendum, or person.readResume.
 *
 * In the demo with no keys the workspaces live in the visitor's browser, so
 * this only reads the file and returns it; the browser keeps it.
 */
export async function POST(request: NextRequest) {
  if (replayActive()) {
    const read = await readUpload(request);
    return "error" in read ? read.error : NextResponse.json({ ok: true, parsed: read.parsed, pages: read.parsed.pageCount });
  }
  if (!isDemoMode()) return handle(request);
  const { DEMO_COOKIE, runInSession } = await import("@/lib/services/demo-session");
  return runInSession(request.cookies.get(DEMO_COOKIE)?.value, () => handle(request));
}

async function readUpload(request: NextRequest): Promise<{ parsed: ParsedUpload; buffer: Buffer } | { error: NextResponse }> {
  const fail = (error: string, status = 400) => ({ error: NextResponse.json({ ok: false, error }, { status }) });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const type = String(form?.get("type") ?? "rfp");
  if (!TYPES.has(type)) return fail("Unknown document type.");
  if (!(file instanceof File)) return fail("Choose a file first.");
  if (file.size > MAX_BYTES) return fail("That file is over 40 MB. Split it, or upload the main solicitation document.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let pages: { page: number; text: string }[];
  if (isPdf) {
    const { pdfPages } = await import("@/lib/crawl");
    pages = await pdfPages(buffer).catch(() => []);
    if (pages.reduce((n, p) => n + p.text.trim().length, 0) < 200) return fail("We could not read text in that PDF. If it is a scan, it needs a text layer first (most PDF tools can add one).");
  } else {
    const t = await fileToText(buffer, file.type, file.name);
    if (!t.ok) return fail(t.message);
    pages = [{ page: 1, text: t.text }];
  }
  const parsed: ParsedUpload = { type: type as Document["type"], title: file.name.replace(/\.[^.]+$/, ""), fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, pageCount: pages.length, text: pages.map((p) => p.text).join("\n"), pages };
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
    const [{ state, newId, now }, { rememberDocumentPages }] = await Promise.all([import("@/lib/services/mock"), import("@/lib/services/mock-segments")]);
    doc = { id: newId("doc"), orgId: state.org.id, type: parsed.type, title: parsed.title, fileName: parsed.fileName, mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes, status: "ready", pageCount: parsed.pageCount, factCount: 0, uploadedAt: now() };
    state.documents.unshift(doc);
    state.documentTexts[doc.id] = parsed.text;
    rememberDocumentPages(doc.id, parsed.fileName, parsed.pages ?? []);
  } else {
    const { adminClient } = await import("@/lib/supabase/clients");
    const { map } = await import("@/lib/services/supabase");
    const db = adminClient();
    const path = `${who.orgId}/${Date.now()}-${parsed.fileName.replace(/[^\w.-]+/g, "_")}`;
    const up = await db.storage.from("documents").upload(path, buffer, { contentType: parsed.mimeType, upsert: false });
    if (up.error) return NextResponse.json({ ok: false, error: `We could not store the file: ${up.error.message}` }, { status: 500 });
    const { data, error } = await db.from("documents").insert({ org_id: who.orgId, type: parsed.type, title: parsed.title, file_name: parsed.fileName, storage_path: path, mime_type: parsed.mimeType, size_bytes: parsed.sizeBytes, status: "ready", page_count: parsed.pageCount, extracted_text: parsed.text }).select("*").single();
    if (error || !data) return NextResponse.json({ ok: false, error: "We stored the file but could not record it. Try again." }, { status: 500 });
    await db.from("document_pages").insert({ document_id: data.id, org_id: who.orgId, pages: parsed.pages });
    doc = map.document(data);
  }
  return NextResponse.json({ ok: true, document: doc, pages: parsed.pageCount });
}
