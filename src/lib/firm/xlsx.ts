import yauzl from "yauzl";
import type { Table } from "./import";

/**
 * The first worksheet of an .xlsx file as a table, read from the zip with no spreadsheet library: shared strings,
 * inline strings, numbers, and booleans. Dates stored as serial numbers come back as YYYY-MM-DD when the cell's
 * style is a date format is unknown, so numbers stay numbers; the importer reads years and dates from text.
 */
function entries(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("Not a zip file"));
      const out = new Map<string, Buffer>();
      zip.readEntry();
      zip.on("entry", (e: yauzl.Entry) => {
        if (!/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(e.fileName)) return zip.readEntry();
        zip.openReadStream(e, (e2, s) => {
          if (e2 || !s) return reject(e2);
          const chunks: Buffer[] = [];
          s.on("data", (c: Buffer) => chunks.push(c));
          s.on("end", () => {
            out.set(e.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(out));
      zip.on("error", reject);
    });
  });
}

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsx(buffer: Buffer): Promise<Table> {
  const files = await entries(buffer);
  const shared = (files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").match(/<si>[\s\S]*?<\/si>/g)?.map((si) => unescape((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))) ?? [];
  // The first sheet in workbook order.
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const firstRid = workbook.match(/<sheet [^>]*r:id="([^"]+)"/)?.[1];
  const target = firstRid ? rels.match(new RegExp(`Id="${firstRid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${firstRid}"`))?.[1] : null;
  const sheetPath = target ? `xl/${target.replace(/^\/?xl\//, "")}` : "xl/worksheets/sheet1.xml";
  const xml = (files.get(sheetPath) ?? files.get("xl/worksheets/sheet1.xml"))?.toString("utf8");
  if (!xml) throw new Error("The workbook has no sheets we can read.");
  const rows: string[][] = [];
  for (const rowXml of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const row: string[] = [];
    for (const c of rowXml.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = c.match(/ r="([A-Z]+\d+)"/)?.[1];
      const type = c.match(/ t="([^"]+)"/)?.[1];
      const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = c.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      let value = "";
      if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = unescape(inline ?? "");
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else value = v !== undefined ? unescape(v) : "";
      row[ref ? colIndex(ref) : row.length] = value.trim();
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  const nonEmpty = rows.filter((r) => r.some(Boolean));
  const [headers = [], ...rest] = nonEmpty;
  return { headers, rows: rest };
}
