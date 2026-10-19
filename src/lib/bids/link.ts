import type { RfpPage } from "./rfp";

/** Read a solicitation from a link, page by page for a PDF. Server only (Buffer, cheerio, no CORS). */
export async function linkPages(url: string): Promise<{ pages: RfpPage[]; title: string | null } | { error: string }> {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return { error: "That does not look like a web address." };
  }
  let res: Response;
  try {
    res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; proposal-reader)" }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
  } catch {
    return { error: `We could not reach ${u.hostname}. If the solicitation sits behind a login, download it and upload the file instead.` };
  }
  if (!res.ok) return { error: `${u.hostname} answered ${res.status}. If the solicitation sits behind a login, download it and upload the file instead.` };
  const type = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (/pdf/i.test(type) || u.pathname.toLowerCase().endsWith(".pdf")) {
    const { pdfPages } = await import("@/lib/crawl");
    return { pages: await pdfPages(buf), title: null };
  }
  const html = buf.toString("utf8");
  const { load } = await import("cheerio");
  const $ = load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const title = $("title").first().text().trim() || null;
  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { pages: [{ page: 1, text }], title };
}
