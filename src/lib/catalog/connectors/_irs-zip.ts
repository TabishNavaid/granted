import { crc32, inflateRawSync } from "node:zlib";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoliteFetch } from "../types";

/**
 * Reads single members out of the IRS e-file batch zips (100 MB to several GB each) with HTTP Range requests,
 * so a whole zip is never downloaded: one request for the tail (end of central directory), one for the central
 * directory (cached on disk per batch), and one per member. Handles ZIP64 and the Deflate64 method that some
 * IRS batches use for every member (Node's zlib cannot decode it).
 */

export interface ZipEntry {
  offset: number;
  compSize: number;
  size: number;
  method: number;
  crc: number;
}

export type ZipDirectory = Map<string, ZipEntry>;

const MAX_MEMBER_BYTES = 25 * 1024 * 1024;

function u16(b: Buffer, o: number) {
  return b.readUInt16LE(o);
}
function u32(b: Buffer, o: number) {
  return b.readUInt32LE(o);
}
function u64(b: Buffer, o: number) {
  return Number(b.readBigUInt64LE(o));
}

async function range(fetch: PoliteFetch, url: string, spec: string): Promise<{ data: Buffer; total: number | null }> {
  const res = await fetch(url, { headers: { range: `bytes=${spec}` }, timeoutMs: 120_000 });
  if (res.status !== 206) {
    await res.body?.cancel().catch(() => undefined);
    throw new Error(`Range request not honored (HTTP ${res.status}) for ${url}`);
  }
  const cr = res.headers.get("content-range") ?? "";
  const total = Number(cr.split("/")[1]);
  return { data: Buffer.from(await res.arrayBuffer()), total: Number.isFinite(total) ? total : null };
}

/** Parse a central directory buffer into member name to entry, keeping only names that pass `keep`. */
export function parseCentralDirectory(cd: Buffer, keep: (name: string) => boolean = () => true): ZipDirectory {
  const out: ZipDirectory = new Map();
  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50) {
    const method = u16(cd, p + 10);
    const crc = u32(cd, p + 16);
    let compSize = u32(cd, p + 20);
    let size = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let offset = u32(cd, p + 42);
    const name = cd.toString("latin1", p + 46, p + 46 + nameLen);
    // ZIP64 extra field: the 8-byte values appear only for fields saturated at 0xFFFFFFFF, in this order.
    let e = p + 46 + nameLen;
    const end = e + extraLen;
    while (e + 4 <= end) {
      const id = u16(cd, e);
      const len = u16(cd, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = u64(cd, q);
          q += 8;
        }
        if (compSize === 0xffffffff) {
          compSize = u64(cd, q);
          q += 8;
        }
        if (offset === 0xffffffff) offset = u64(cd, q);
      }
      e += 4 + len;
    }
    const base = name.replace(/^.*\//, "");
    if (keep(base)) out.set(base, { offset, compSize, size, method, crc });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Locate the central directory from the tail of the file (EOCD, with the ZIP64 record when present). */
export function locateCentralDirectory(tail: Buffer, tailStart: number): { cdOffset: number; cdSize: number; zip64At: number | null } {
  let i = tail.length - 22;
  while (i >= 0 && u32(tail, i) !== 0x06054b50) i--;
  if (i < 0) throw new Error("No end of central directory record");
  let cdSize = u32(tail, i + 12);
  let cdOffset = u32(tail, i + 16);
  const entries = u16(tail, i + 10);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || entries === 0xffff) {
    const loc = i - 20;
    if (loc < 0 || u32(tail, loc) !== 0x07064b50) throw new Error("ZIP64 locator missing");
    const z64 = u64(tail, loc + 8);
    const rel = z64 - tailStart;
    if (rel < 0 || u32(tail, rel) !== 0x06064b50) return { cdOffset: -1, cdSize: -1, zip64At: z64 };
    cdSize = u64(tail, rel + 40);
    cdOffset = u64(tail, rel + 48);
  }
  return { cdOffset, cdSize, zip64At: null };
}

/** The central directory of a remote zip, as member name (no folder) to entry. */
export async function remoteDirectory(fetch: PoliteFetch, url: string, keep?: (name: string) => boolean): Promise<ZipDirectory> {
  const { data: tail, total } = await range(fetch, url, "-131072");
  if (!total) throw new Error(`No size for ${url}`);
  const tailStart = total - tail.length;
  let loc = locateCentralDirectory(tail, tailStart);
  if (loc.zip64At !== null) {
    const { data } = await range(fetch, url, `${loc.zip64At}-${loc.zip64At + 55}`);
    if (u32(data, 0) !== 0x06064b50) throw new Error("Bad ZIP64 end record");
    loc = { cdSize: u64(data, 40), cdOffset: u64(data, 48), zip64At: null };
  }
  let cd: Buffer;
  if (loc.cdOffset >= tailStart) cd = tail.subarray(loc.cdOffset - tailStart, loc.cdOffset - tailStart + loc.cdSize);
  else cd = (await range(fetch, url, `${loc.cdOffset}-${loc.cdOffset + loc.cdSize - 1}`)).data;
  return parseCentralDirectory(cd, keep);
}

/** Decompress one member's raw bytes and check its size and CRC. */
export function inflateMember(raw: Buffer, entry: ZipEntry): Buffer {
  let data: Buffer;
  if (entry.method === 0) data = raw;
  else if (entry.method === 8) data = inflateRawSync(raw);
  else if (entry.method === 9) data = inflate64(raw, entry.size);
  else throw new Error(`Unsupported zip method ${entry.method}`);
  if (data.length !== entry.size || crc32(data) >>> 0 !== entry.crc >>> 0) throw new Error("Zip member size or CRC mismatch");
  return data;
}

/** Fetch and decompress one member using its central directory entry. */
export async function remoteMember(fetch: PoliteFetch, url: string, entry: ZipEntry): Promise<Buffer> {
  if (entry.size > MAX_MEMBER_BYTES) throw new Error(`Member too large (${entry.size} bytes)`);
  const slack = 1024;
  let { data } = await range(fetch, url, `${entry.offset}-${entry.offset + 30 + entry.compSize + slack - 1}`);
  if (u32(data, 0) !== 0x04034b50) throw new Error("Bad local file header");
  const start = 30 + u16(data, 26) + u16(data, 28);
  if (start + entry.compSize > data.length) {
    data = (await range(fetch, url, `${entry.offset}-${entry.offset + start + entry.compSize - 1}`)).data;
  }
  return inflateMember(data.subarray(start, start + entry.compSize), entry);
}

/**
 * Batch zips by URL, with each central directory parsed once and kept on disk (they do not change once
 * published), so a resumed run does not fetch them again.
 */
export class RemoteZips {
  private dirs = new Map<string, Promise<ZipDirectory>>();
  requests = 0;
  constructor(
    private fetch: PoliteFetch,
    private cacheDir: string,
  ) {}

  directory(url: string): Promise<ZipDirectory> {
    let p = this.dirs.get(url);
    if (!p) {
      p = this.load(url);
      p.catch(() => this.dirs.delete(url));
      this.dirs.set(url, p);
    }
    return p;
  }

  private async load(url: string): Promise<ZipDirectory> {
    const file = path.join(this.cacheDir, "zipdirs", `${url.replace(/^.*\/xml\//, "").replace(/[^A-Za-z0-9_.-]+/g, "_")}.json`);
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as Record<string, [number, number, number, number, number]>;
      return new Map(Object.entries(cached).map(([k, v]) => [k, { offset: v[0], compSize: v[1], size: v[2], method: v[3], crc: v[4] }]));
    } catch {
      // not cached
    }
    this.requests += 2;
    const dir = await remoteDirectory(this.fetch, url, (n) => /_public\.xml$/i.test(n));
    await mkdir(path.dirname(file), { recursive: true });
    const obj: Record<string, number[]> = {};
    for (const [k, e] of dir) obj[k] = [e.offset, e.compSize, e.size, e.method, e.crc];
    await writeFile(`${file}.part`, JSON.stringify(obj));
    await rename(`${file}.part`, file);
    return dir;
  }

  async member(url: string, name: string): Promise<Buffer | null> {
    const dir = await this.directory(url);
    const entry = dir.get(name);
    if (!entry) return null;
    this.requests++;
    return remoteMember(this.fetch, url, entry);
  }
}

// ---------- Deflate64 (zip method 9) ----------
// Standard DEFLATE with three changes: a 64 KiB window, length code 285 meaning 3 + 16 extra bits,
// and distance codes 30 and 31. Canonical Huffman decoding as in zlib's puff.c.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 3];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 16];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 32769, 49153];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huffman {
  count: Uint16Array;
  symbol: Uint16Array;
}

function huffman(lengths: ArrayLike<number>, n: number): Huffman {
  const count = new Uint16Array(16);
  const symbol = new Uint16Array(n);
  for (let s = 0; s < n; s++) count[lengths[s]]++;
  const offs = new Uint16Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = offs[len] + count[len];
  for (let s = 0; s < n; s++) if (lengths[s]) symbol[offs[lengths[s]]++] = s;
  return { count, symbol };
}

class Bits {
  pos = 0;
  bitbuf = 0;
  bitcnt = 0;
  constructor(private data: Buffer) {}
  bits(need: number): number {
    let val = this.bitbuf;
    while (this.bitcnt < need) {
      if (this.pos >= this.data.length) throw new Error("deflate64: unexpected end of data");
      val |= this.data[this.pos++] << this.bitcnt;
      this.bitcnt += 8;
    }
    // need can be 16 here; keep the arithmetic in 32-bit range.
    this.bitbuf = need >= 32 ? 0 : val >>> need;
    this.bitcnt -= need;
    return need >= 32 ? val : val & ((1 << need) - 1);
  }
  align() {
    this.bitbuf = 0;
    this.bitcnt = 0;
  }
  byte(): number {
    if (this.pos >= this.data.length) throw new Error("deflate64: unexpected end of data");
    return this.data[this.pos++];
  }
}

function decode(s: Bits, h: Huffman): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= 15; len++) {
    code |= s.bits(1);
    const count = h.count[len];
    if (code - count < first) return h.symbol[index + (code - first)];
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error("deflate64: bad Huffman code");
}

let fixed: { lit: Huffman; dist: Huffman } | null = null;
function fixedTables() {
  if (!fixed) {
    const l = new Uint8Array(288);
    for (let i = 0; i < 144; i++) l[i] = 8;
    for (let i = 144; i < 256; i++) l[i] = 9;
    for (let i = 256; i < 280; i++) l[i] = 7;
    for (let i = 280; i < 288; i++) l[i] = 8;
    fixed = { lit: huffman(l, 288), dist: huffman(new Uint8Array(32).fill(5), 32) };
  }
  return fixed;
}

export function inflate64(data: Buffer, expected: number): Buffer {
  const out = Buffer.alloc(expected);
  let o = 0;
  const s = new Bits(data);
  let last = 0;
  while (!last) {
    last = s.bits(1);
    const type = s.bits(2);
    if (type === 0) {
      s.align();
      const len = s.byte() | (s.byte() << 8);
      s.byte();
      s.byte();
      if (o + len > expected) throw new Error("deflate64: output larger than declared size");
      for (let i = 0; i < len; i++) out[o++] = s.byte();
      continue;
    }
    let lit: Huffman;
    let dist: Huffman;
    if (type === 1) ({ lit, dist } = fixedTables());
    else if (type === 2) {
      const nlen = s.bits(5) + 257;
      const ndist = s.bits(5) + 1;
      const ncode = s.bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < ncode; i++) cl[CL_ORDER[i]] = s.bits(3);
      const clh = huffman(cl, 19);
      const lens = new Uint8Array(nlen + ndist);
      let i = 0;
      while (i < nlen + ndist) {
        const sym = decode(s, clh);
        if (sym < 16) lens[i++] = sym;
        else {
          let len = 0;
          let rep: number;
          if (sym === 16) {
            if (i === 0) throw new Error("deflate64: repeat with no length");
            len = lens[i - 1];
            rep = 3 + s.bits(2);
          } else if (sym === 17) rep = 3 + s.bits(3);
          else rep = 11 + s.bits(7);
          if (i + rep > nlen + ndist) throw new Error("deflate64: too many lengths");
          while (rep--) lens[i++] = len;
        }
      }
      lit = huffman(lens.subarray(0, nlen), nlen);
      dist = huffman(lens.subarray(nlen), ndist);
    } else throw new Error("deflate64: bad block type");
    for (;;) {
      const sym = decode(s, lit);
      if (sym < 256) {
        if (o >= expected) throw new Error("deflate64: output larger than declared size");
        out[o++] = sym;
      } else if (sym === 256) break;
      else {
        const li = sym - 257;
        if (li >= LEN_BASE.length) throw new Error("deflate64: bad length code");
        const len = LEN_BASE[li] + s.bits(LEN_EXTRA[li]);
        const di = decode(s, dist);
        const d = DIST_BASE[di] + s.bits(DIST_EXTRA[di]);
        if (d > o) throw new Error("deflate64: distance too far");
        if (o + len > expected) throw new Error("deflate64: output larger than declared size");
        for (let k = 0; k < len; k++, o++) out[o] = out[o - d];
      }
    }
  }
  return o === expected ? out : out.subarray(0, o);
}
