import * as cheerio from "cheerio";

/**
 * Reads an organization's public website: the homepage plus the most relevant
 * linked pages (about, programs, impact, annual report, PDFs), up to a cap.
 * Markup is stripped to readable text. One request at a time, with a timeout
 * and a size cap, so a slow site cannot hang a run.
 */
export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  kind: "html" | "pdf";
}

export interface CrawlResult {
  homepage: string;
  pages: CrawledPage[];
  skipped: { url: string; reason: string }[];
}

export class CrawlError extends Error {
  constructor(
    message: string,
    public readonly code: "bad_url" | "unreachable",
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

// A browser-like agent: the site owner asked us to read their own site, and many small-nonprofit hosts block anything that says "bot".
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 8_000_000;
const MAX_TEXT_PER_PAGE = 14_000;
const MAX_PDF_TEXT = 20_000;
const POLITE_DELAY_MS = 350;

/** Words in a link's path or text that mark a page worth reading, with weights. */
const LINK_SIGNALS: [RegExp, number][] = [
  [/annual[-_ ]?report|impact[-_ ]?report|year[-_ ]in[-_ ]review/i, 7],
  [/\babout\b|who[-_ ]we[-_ ]are|our[-_ ]story|mission|history/i, 6],
  [/programs?\b|services|what[-_ ]we[-_ ]do|our[-_ ]work|initiatives/i, 6],
  [/impact|results|outcomes|by[-_ ]the[-_ ]numbers|our[-_ ]reach/i, 5],
  [/financials?|990|transparency|accountability/i, 4],
  [/team|staff|leadership|board/i, 2],
  [/\.pdf(\?|$)/i, 2],
];
const LINK_NOISE = /\b(login|signin|sign-in|cart|checkout|privacy|terms|cookie|donate|give|shop|store|events?\/|calendar|news\/|blog\/|press|careers|jobs|volunteer-signup|facebook|twitter|instagram|linkedin|youtube|wp-admin|feed|rss|\.jpg|\.png|\.gif|\.zip|\.mp4)\b/i;

export function normalizeUrl(input: string): string {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new CrawlError("That does not look like a website address.", "bad_url");
  }
  if (!/^[\w.-]+\.[a-z]{2,}$/i.test(u.hostname)) throw new CrawlError("That does not look like a website address.", "bad_url");
  u.hash = "";
  return u.toString();
}

function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./, "").toLowerCase();
  return strip(a.hostname) === strip(b.hostname);
}

async function fetchWithLimits(url: string): Promise<{ ok: true; contentType: string; body: Buffer; finalUrl: string } | { ok: false; reason: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5", "accept-language": "en-US,en;q=0.8" },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") ?? "";
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return { ok: false, reason: "too large" };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return { ok: false, reason: "too large" };
    return { ok: true, contentType, body: buf, finalUrl: res.url || url };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? "timed out" : err.message) : String(err);
    return { ok: false, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function cleanText(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ParsedHtml {
  title: string;
  text: string;
  links: { href: string; text: string }[];
}

export function parseHtml(html: string, baseUrl: string): ParsedHtml {
  const $ = cheerio.load(html);
  const title = cleanText($("title").first().text() || $("h1").first().text() || "");
  const links: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl);
      if (!/^https?:$/.test(abs.protocol)) return;
      abs.hash = "";
      links.push({ href: abs.toString(), text: cleanText($(el).text()).slice(0, 80) });
    } catch {
      // ignore bad hrefs
    }
  });
  $("script, style, noscript, svg, iframe, form, nav, footer, header, aside, [role=navigation], [aria-hidden=true], .cookie, #cookie, .menu, .nav").remove();
  $("br").replaceWith("\n");
  $("p, div, section, article, li, h1, h2, h3, h4, h5, h6, tr, blockquote, figcaption, dt, dd").each((_, el) => {
    $(el).prepend("\n").append("\n");
  });
  const root = $("main").length ? $("main") : $("body");
  const text = cleanText(root.text()).slice(0, MAX_TEXT_PER_PAGE);
  return { title, text, links };
}

async function pdfToText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText({ last: 12 });
    return cleanText(result.text).slice(0, MAX_PDF_TEXT);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function scoreLink(link: { href: string; text: string }, home: URL): number {
  let u: URL;
  try {
    u = new URL(link.href);
  } catch {
    return -1;
  }
  if (!sameSite(u, home)) return -1;
  const hay = `${u.pathname} ${link.text}`;
  if (LINK_NOISE.test(hay)) return -1;
  if (u.pathname === "/" || u.pathname === "") return -1;
  let score = 0;
  for (const [re, w] of LINK_SIGNALS) if (re.test(hay)) score += w;
  // Shallow paths are more likely to be the real section pages; long dated slugs are posts.
  const segments = u.pathname.split("/").filter(Boolean);
  score -= Math.max(0, segments.length - 2);
  const last = segments[segments.length - 1] ?? "";
  if ((last.match(/-/g) ?? []).length >= 4 || /\/\d{4}\/\d{2}\//.test(u.pathname)) score -= 4;
  return score;
}

export async function crawlSite(input: string, opts: { maxPages?: number; onPage?: (page: CrawledPage, index: number) => void } = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 8;
  const homepage = normalizeUrl(input);
  const home = new URL(homepage);
  const pages: CrawledPage[] = [];
  const skipped: CrawlResult["skipped"] = [];
  const seen = new Set<string>();
  const keyOf = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();

  const first = await fetchWithLimits(homepage);
  if (!first.ok) throw new CrawlError(`We couldn't reach ${home.hostname} (${first.reason}).`, "unreachable");
  const canonical = new URL(first.finalUrl);
  seen.add(keyOf(homepage));
  seen.add(keyOf(first.finalUrl));
  const parsedHome = parseHtml(first.body.toString("utf8"), first.finalUrl);
  pages.push({ url: first.finalUrl, title: parsedHome.title || canonical.hostname, text: parsedHome.text, kind: "html" });
  opts.onPage?.(pages[0], 0);

  // Rank candidate links from the homepage; pages we read may add a few more.
  const queue = new Map<string, number>();
  const consider = (links: { href: string; text: string }[]) => {
    for (const l of links) {
      const key = keyOf(l.href);
      if (seen.has(key)) continue;
      const s = scoreLink(l, canonical);
      if (s <= 0) continue;
      queue.set(l.href, Math.max(queue.get(l.href) ?? 0, s));
    }
  };
  consider(parsedHome.links);

  while (pages.length < maxPages && queue.size) {
    const [next] = [...queue.entries()].sort((a, b) => b[1] - a[1])[0];
    queue.delete(next);
    if (seen.has(keyOf(next))) continue;
    seen.add(keyOf(next));
    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
    const res = await fetchWithLimits(next);
    if (!res.ok) {
      skipped.push({ url: next, reason: res.reason });
      continue;
    }
    const isPdf = /application\/pdf/i.test(res.contentType) || /\.pdf(\?|$)/i.test(res.finalUrl);
    if (isPdf) {
      try {
        const text = await pdfToText(res.body);
        if (text.length > 200) {
          pages.push({ url: res.finalUrl, title: decodeURIComponent(new URL(res.finalUrl).pathname.split("/").pop() ?? "PDF"), text, kind: "pdf" });
          opts.onPage?.(pages[pages.length - 1], pages.length - 1);
        } else skipped.push({ url: next, reason: "no readable text" });
      } catch (err) {
        skipped.push({ url: next, reason: `PDF: ${err instanceof Error ? err.message : String(err)}` });
      }
      continue;
    }
    if (!/text\/html|application\/xhtml/i.test(res.contentType)) {
      skipped.push({ url: next, reason: `not a page (${res.contentType.split(";")[0] || "unknown type"})` });
      continue;
    }
    if (seen.has(keyOf(res.finalUrl)) && keyOf(res.finalUrl) !== keyOf(next)) {
      skipped.push({ url: next, reason: "same page as one already read" });
      continue;
    }
    seen.add(keyOf(res.finalUrl));
    const parsed = parseHtml(res.body.toString("utf8"), res.finalUrl);
    if (parsed.text.length < 120) {
      skipped.push({ url: next, reason: "almost empty" });
      continue;
    }
    pages.push({ url: res.finalUrl, title: parsed.title || next, text: parsed.text, kind: "html" });
    opts.onPage?.(pages[pages.length - 1], pages.length - 1);
    consider(parsed.links);
  }

  return { homepage: first.finalUrl, pages, skipped };
}

/** "riverbendyouth.org/about" for a source chip. */
export function sourceLabelFor(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/$/, "");
    const label = `${u.hostname.replace(/^www\./, "")}${p}`;
    return label.length > 42 ? `${label.slice(0, 40)}…` : label;
  } catch {
    return url;
  }
}
