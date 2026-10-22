import { NextResponse, type NextRequest } from "next/server";
import { parseTable } from "@/lib/firm/import";
import { readXlsx } from "@/lib/firm/xlsx";

/**
 * Reads an uploaded spreadsheet (.csv, .tsv, .txt, or .xlsx) into headers and rows for the import preview.
 * Stateless: nothing is stored here; the person checks the preview and the records are saved by the services.
 */
export const runtime = "nodejs";
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose a file first." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "That spreadsheet is over 4 MB. Save just the list as a CSV and try again." }, { status: 400 });
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".xlsx")) return NextResponse.json({ ok: true, table: await readXlsx(Buffer.from(await file.arrayBuffer())) });
    if (/\.(csv|tsv|txt)$/.test(name)) return NextResponse.json({ ok: true, table: parseTable(await file.text()) });
    return NextResponse.json({ ok: false, error: "We can read .xlsx, .csv, and .tsv files. In Excel, Save As and choose CSV, or copy the rows and paste them instead." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `We could not read that file: ${err instanceof Error ? err.message : "unknown error"}.` }, { status: 400 });
  }
}
