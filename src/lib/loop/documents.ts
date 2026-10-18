import { extractProfile, type ExtractedFact } from "./profile";
import type { TokenUsage } from "@/lib/ai";

/**
 * Facts from an uploaded document. The document's text is treated as one
 * page whose "URL" is the document id, so the same excerpt and number checks
 * apply. Returned facts carry the excerpt and are stored with the document as
 * their source.
 */
export async function extractFromDocument(doc: { id: string; title: string; text: string }): Promise<{ facts: ExtractedFact[]; dropped: number; usage: TokenUsage; costUsd: number; model: string }> {
  const page = { url: `document:${doc.id}`, title: doc.title, text: doc.text.slice(0, 60_000), kind: "pdf" as const };
  const r = await extractProfile([page]);
  return { facts: r.facts, dropped: r.dropped.length, usage: r.usage, costUsd: r.costUsd, model: r.model };
}

/** Plain text from an uploaded file. PDF, Word, and text files; anything else is refused. */
export async function fileToText(buffer: Buffer, mimeType: string, fileName: string): Promise<{ ok: true; text: string; pages: number | null } | { ok: false; message: string }> {
  const name = fileName.toLowerCase();
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const { pdfToText } = await import("@/lib/crawl");
    const text = await pdfToText(buffer, { pages: 60, maxChars: 120_000 });
    return text.trim().length > 50 ? { ok: true, text, pages: null } : { ok: false, message: "We could not read any text in that PDF. If it is a scan, it needs text first." };
  }
  if (name.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = await docxToText(buffer);
    return text.trim().length > 50 ? { ok: true, text, pages: null } : { ok: false, message: "We could not read any text in that Word file." };
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || mimeType.startsWith("text/")) {
    return { ok: true, text: buffer.toString("utf8").slice(0, 120_000), pages: null };
  }
  return { ok: false, message: "We can read PDF, Word (.docx), and plain text files. Excel and older .doc files are not supported yet." };
}

/** A .docx is a zip of XML; the body text lives in word/document.xml. No library needed for text. */
async function docxToText(buffer: Buffer): Promise<string> {
  const { inflateRawSync } = await import("node:zlib");
  // Walk the central directory to find word/document.xml.
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return "";
  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (name === "word/document.xml") {
      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const data = buffer.subarray(start, start + compSize);
      const xml = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
      return xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return "";
}
