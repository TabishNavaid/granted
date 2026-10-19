#!/usr/bin/env python3
"""Build src/data/foundations.json from public-domain IRS data.

What it does
------------
1. Downloads (and caches) the IRS Exempt Organizations Business Master File
   (BMF) state extracts, e.g. https://www.irs.gov/pub/irs-soi/eo_oh.csv, and
   keeps organizations with FOUNDATION code 04 (private non-operating
   foundation, the grantmakers).
2. Downloads (and caches) the IRS Form 990-series e-file index for each year
   given (https://apps.irs.gov/pub/epostcard/990/xml/<YEAR>/index_<YEAR>.csv),
   keeps RETURN_TYPE == "990PF" rows whose EIN is one of those foundations,
   and keeps only the newest return per EIN across all years.
3. Picks candidates per state, spread across asset-size bands (BMF ASSET_AMT),
   in a deterministic shuffled order.
4. For each candidate, reads only `<OBJECT_ID>_public.xml` out of the batch zip
   https://apps.irs.gov/pub/epostcard/990/xml/<YEAR>/<XML_BATCH_ID>.zip using
   HTTP Range requests (a seekable file object handed to `zipfile`), so whole
   zips (100 to 500 MB) are never downloaded. Extracted XML is cached.
5. Parses the 990-PF (namespace http://www.irs.gov/efile, matched by local
   name so schema-year differences are tolerated), keeps foundations that paid
   at least --min-grants grants to organizations and at least --min-giving
   dollars in total, derives summary fields and focus labels, and writes the
   JSON (minified).

Officers, directors and trustees (Part VII-A) are stored as {name, title}, at
most 12, without compensation. `purposeSample` holds up to 3 distinct,
non-generic grant purposes ranked by dollars.

Grants to individuals are never stored by name. They are excluded from grant
counts and statistics; their purposes only feed the "Scholarships" label.

Usage
-----
    python3 -I scripts/foundations/build_foundations.py \\
        --cache /path/to/irs-cache \\
        --states OH,KY,NC \\
        --years 2025,2024 \\
        --out src/data/foundations.json

Only the Python standard library is used. All network requests are sequential.

Focus label rules
-----------------
Each organization grant gets a text = purpose + " " + recipient name
(lowercased). Each label below has a regex (FOCUS_RULES); a grant may match
several labels. Some labels have an exclusion regex (e.g. "children's hospital"
does not count as Youth development). "Rural health" needs a Health match AND
a rural text cue (RURAL_CUE: rural, critical access, county hospital, county
health or health department, Appalachia, mountain, farmworker, community
health center, free clinic, mobile clinic). For each label we sum the dollar amount and the
count of matching grants. A label is kept when its matched dollars are at
least 10% of organization giving OR its matched grants are at least 15% of
organization grants (and at least 2 grants). Labels are ranked by matched
dollars and the top 4 are kept. If nothing passes the threshold, the single
best label with any match is used. "Scholarships" also counts grants to
individuals whose purpose mentions scholarship/tuition/education.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import os
import random
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
import zlib
from collections import Counter, defaultdict

USER_AGENT = "granted-foundations-build/1.0 (public IRS data; stdlib urllib)"
BMF_URL = "https://www.irs.gov/pub/irs-soi/eo_{st}.csv"
INDEX_URL = "https://apps.irs.gov/pub/epostcard/990/xml/{year}/index_{year}.csv"
ZIP_URL = "https://apps.irs.gov/pub/epostcard/990/xml/{year}/{batch}.zip"

MAX_XML_BYTES = 25 * 1024 * 1024  # skip absurdly large members
SAFE_ID = re.compile(r"^[A-Za-z0-9_]+$")

# Asset bands (BMF ASSET_AMT, dollars) and the share of each state's target
# drawn from each band, to get a spread of sizes. Unfilled quota rolls over.
BANDS = [
    (300_000, 1_000_000, 0.20),
    (1_000_000, 5_000_000, 0.30),
    (5_000_000, 25_000_000, 0.25),
    (25_000_000, 100_000_000, 0.15),
    (100_000_000, float("inf"), 0.10),
]

FOCUS_ORDER = [
    "Youth development", "Education", "Food security", "Health", "Rural health",
    "Human services", "Housing", "Arts and culture", "Environment",
    "Community development", "Religion", "Animals", "Scholarships",
]

# label -> (include regex, exclude regex or None). Applied to lowercased text.
FOCUS_RULES = {
    "Youth development": (
        r"boys? ?(&|and)? ?girls? club|boy scouts?|girl scouts?|\bscouts?\b|scouting|\bymca\b|\bywca\b|"
        r"\b4-?h\b|big brothers|big sisters|\byouth\b|\bchild(ren)?'?s?\b|\bkids?\b|\bteens?\b|\bcamps?\b|"
        r"little league|junior achievement|after[- ]?school|mentor|young life|\bfuture farmers|\bffa\b|"
        r"juvenile|adolescen",
        r"children'?s hospital|children'?s medical|childrens hospital|kids'? cancer",
    ),
    "Education": (
        r"school|universit|college|academ(y|ic)|education|\blibrar|literacy|\bstem\b|tutor|"
        r"\bpta\b|\bpto\b|seminary|institute of technology|learning|students?\b|teacher|classroom|"
        r"head start|pre-?k\b|preschool|montessori|curriculum",
        None,
    ),
    "Food security": (
        r"food ?bank|food pantr|pantry|hunger|\bmeals?\b|feeding|second harvest|soup kitchen|"
        r"nutrition|\bfood\b|harvesters|feed the|backpack program|manna|loaves",
        r"food allergy",
    ),
    "Health": (
        r"hospital|health|medical|medicine|cancer|clinic|hospice|heart association|alzheimer|"
        r"diabetes|mental|disease|research foundation|cystic|leukemia|lymphoma|autism|"
        r"nursing|dental|\bmed\b|cleveland clinic|ronald mcdonald|physician|wellness|"
        r"addiction|recovery|substance|rehabilitation|disabilit|blind|deaf|lung|kidney|"
        r"march of dimes|st\.? jude|muscular|parkinson|ms society|multiple sclerosis|"
        r"behavioral|pregnancy|maternal|patient",
        None,
    ),
    "Human services": (
        r"united way|salvation army|red cross|family services|social services|human services|"
        r"goodwill|catholic charities|lutheran services|community action|shelter|homeless|"
        r"domestic violence|crisis|refugee|emergency (assistance|relief)|relief fund|disaster|"
        r"\bneedy\b|\bpoor\b|poverty|seniors?\b|elderly|aging|volunteers of america|"
        r"family promise|ministries of|rescue mission|city mission|union mission|charities\b|"
        r"benevolen|welfare|assistance|outreach|\bcare\b|caregiv|foster|adoption|veterans?",
        None,
    ),
    "Housing": (
        r"habitat for humanity|housing|homeless|shelter|\bhomes?\b(?! ?(health|care))|"
        r"affordable|transitional living|family promise|rebuilding together",
        r"nursing home|funeral home",
    ),
    "Arts and culture": (
        r"museum|symphony|orchestra|theat(er|re)|\barts?\b|ballet|opera|public radio|\bpbs\b|"
        r"\bnpr\b|public media|historical|history|heritage|music|dance|choir|chorale|film|"
        r"library foundation|cultural|culture|gallery|playhouse|festival|preservation society",
        r"martial arts|liberal arts college",
    ),
    "Environment": (
        r"conservanc|nature|\bparks?\b|land trust|environment|arboretum|garden|watershed|"
        r"\briver|\blake\b|forest|conservation|audubon|sierra club|clean water|trails?\b|"
        r"metroparks|greenway|botanical|soil|climate|sustainab|recycl|wildlands",
        r"park(way)? (school|church|elementary)",
    ),
    "Community development": (
        r"community foundation|economic development|downtown|chamber of commerce|revitaliz|"
        r"community development|neighborhood|civic|main street|redevelopment|workforce|"
        r"job training|small business|community center|community improvement|rotary|"
        r"kiwanis|lions club|fire (department|company)|volunteer fire|rescue squad|police|"
        r"city of |village of |county of |township",
        None,
    ),
    "Religion": (
        r"church|ministr|diocese|parish|temple|synagogue|religious|congregation|baptist|"
        r"methodist|lutheran|presbyterian|catholic|episcopal|\bmission\b|missions\b|gospel|"
        r"christian|bible|jewish|islamic|mosque|evangel|faith|worship|chapel|\bumc\b|"
        r"tithe|tithing|\bgod\b|jesus|christ\b|apostolic|pentecostal|mennonite|amish|"
        r"seventh[- ]day|young life|cru\b|navigators|samaritan'?s purse|billy graham",
        None,
    ),
    "Animals": (
        r"humane society|\bspca\b|animal|pets?\b|\bzoo\b|zoolog|wildlife|equine|horse|"
        r"\bdogs?\b|\bcats?\b|veterinar|aquarium|raptor|bird",
        r"bird ?watch",
    ),
    "Scholarships": (
        r"scholarship|tuition|student aid|financial aid|educational award|fellowship",
        None,
    ),
}
RURAL_CUE = re.compile(
    r"rural|critical access|county hospital|county health|health department|appalach|"
    r"frontier nursing|mountain|countryside|farmworker|migrant|community health center|"
    r"free clinic|mobile (clinic|health|unit)"
)
_COMPILED = {k: (re.compile(a), re.compile(b) if b else None) for k, (a, b) in FOCUS_RULES.items()}


# --------------------------------------------------------------------------
# Networking
# --------------------------------------------------------------------------

def _request(url: str, headers: dict | None = None, tries: int = 4) -> tuple[int, dict, bytes]:
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)
    delay = 2.0
    last: Exception | None = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status, dict(r.headers), r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if isinstance(e, urllib.error.HTTPError) and e.code in (404, 416):
                raise
            last = e
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"request failed: {url}: {last}")


def download(url: str, path: str) -> str:
    """Download url to path unless it is already cached."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    tmp = path + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"  downloading {url}", file=sys.stderr)
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, path)
    return path


class HTTPRangeFile(io.RawIOBase):
    """Read-only, seekable file object backed by HTTP Range requests.

    Keeps a single read-ahead buffer so zipfile's many small reads turn into
    a few larger range requests.
    """

    def __init__(self, url: str, readahead: int = 256 * 1024):
        super().__init__()
        self.url = url
        self.readahead = readahead
        self.pos = 0
        self.requests = 0
        self.bytes_fetched = 0
        self._buf_start = 0
        self._buf = b""
        status, headers, _ = _request(url, {"Range": "bytes=0-0"})
        cr = headers.get("Content-Range") or headers.get("content-range")
        if status != 206 or not cr:
            raise RuntimeError(f"server did not honor Range for {url}")
        self.size = int(cr.split("/")[-1])

    def readable(self) -> bool:
        return True

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        if whence == 0:
            self.pos = offset
        elif whence == 1:
            self.pos += offset
        else:
            self.pos = self.size + offset
        self.pos = max(0, self.pos)
        return self.pos

    def _fetch(self, start: int, length: int) -> None:
        end = min(self.size, start + length) - 1
        status, _, data = _request(self.url, {"Range": f"bytes={start}-{end}"})
        if status != 206:
            raise RuntimeError(f"expected 206, got {status}")
        self.requests += 1
        self.bytes_fetched += len(data)
        self._buf_start, self._buf = start, data

    def read(self, n: int = -1) -> bytes:
        if self.pos >= self.size:
            return b""
        if n is None or n < 0:
            n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n == 0:
            return b""
        out = bytearray()
        while n > 0:
            off = self.pos - self._buf_start
            if 0 <= off < len(self._buf):
                chunk = self._buf[off: off + n]
            else:
                self._fetch(self.pos, max(n, self.readahead))
                chunk = self._buf[: n]
                if not chunk:
                    break
            out += chunk
            self.pos += len(chunk)
            n -= len(chunk)
        return bytes(out)

    def readinto(self, b) -> int:
        data = self.read(len(b))
        b[: len(data)] = data
        return len(data)


# --------------------------------------------------------------------------
# Deflate64 (zip method 9). Python's zipfile cannot decode it and some IRS
# batches (e.g. 2025_TEOS_XML_05A) use it for every member. This is a small
# pure-Python inflater: standard DEFLATE plus the Deflate64 changes (64 KiB
# window, length code 285 = 3 + 16 extra bits, distance codes 30 and 31).
# --------------------------------------------------------------------------

_LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
             67, 83, 99, 115, 131, 163, 195, 227, 3]
_LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 16]
_DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
              1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 32769, 49153]
_DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
               11, 11, 12, 12, 13, 13, 14, 14]
_CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]


class _Bits:
    def __init__(self, data: bytes):
        self.data, self.pos, self.bit = data, 0, 0

    def get(self, n: int) -> int:
        v = 0
        for i in range(n):
            if self.pos >= len(self.data):
                raise ValueError("deflate64: unexpected end of data")
            v |= ((self.data[self.pos] >> self.bit) & 1) << i
            self.bit += 1
            if self.bit == 8:
                self.bit, self.pos = 0, self.pos + 1
        return v

    def align(self) -> None:
        if self.bit:
            self.bit, self.pos = 0, self.pos + 1


def _huff(lengths: list[int]) -> dict:
    """Canonical Huffman: returns {(length, code): symbol}."""
    bl_count = Counter(l for l in lengths if l)
    code, next_code = 0, {}
    for bits in range(1, max(lengths, default=0) + 1):
        code = (code + bl_count.get(bits - 1, 0)) << 1
        next_code[bits] = code
    table = {}
    for sym, l in enumerate(lengths):
        if l:
            table[(l, next_code[l])] = sym
            next_code[l] += 1
    return table


def _decode(br: _Bits, table: dict) -> int:
    code = length = 0
    while length < 16:
        code = (code << 1) | br.get(1)
        length += 1
        sym = table.get((length, code))
        if sym is not None:
            return sym
    raise ValueError("deflate64: bad Huffman code")


_FIXED_LIT = _huff([8] * 144 + [9] * 112 + [7] * 24 + [8] * 8)
_FIXED_DIST = _huff([5] * 32)


def inflate64(data: bytes, expected: int | None = None) -> bytes:
    br, out = _Bits(data), bytearray()
    final = 0
    while not final:
        final, btype = br.get(1), br.get(2)
        if btype == 0:
            br.align()
            ln = br.data[br.pos] | (br.data[br.pos + 1] << 8)
            br.pos += 4
            out += br.data[br.pos: br.pos + ln]
            br.pos += ln
            continue
        if btype == 1:
            lit, dist = _FIXED_LIT, _FIXED_DIST
        elif btype == 2:
            hlit, hdist, hclen = br.get(5) + 257, br.get(5) + 1, br.get(4) + 4
            cl = [0] * 19
            for i in range(hclen):
                cl[_CL_ORDER[i]] = br.get(3)
            clt = _huff(cl)
            lens: list[int] = []
            while len(lens) < hlit + hdist:
                sym = _decode(br, clt)
                if sym < 16:
                    lens.append(sym)
                elif sym == 16:
                    lens += [lens[-1]] * (3 + br.get(2))
                elif sym == 17:
                    lens += [0] * (3 + br.get(3))
                else:
                    lens += [0] * (11 + br.get(7))
            lit, dist = _huff(lens[:hlit]), _huff(lens[hlit:])
        else:
            raise ValueError("deflate64: bad block type")
        while True:
            sym = _decode(br, lit)
            if sym < 256:
                out.append(sym)
            elif sym == 256:
                break
            else:
                i = sym - 257
                length = _LEN_BASE[i] + br.get(_LEN_EXTRA[i])
                d = _decode(br, dist)
                distance = _DIST_BASE[d] + br.get(_DIST_EXTRA[d])
                start = len(out) - distance
                if start < 0:
                    raise ValueError("deflate64: distance too far")
                if distance >= length:
                    out += out[start: start + length]
                else:
                    for k in range(length):
                        out.append(out[start + k])
        if expected is not None and len(out) > expected:
            raise ValueError("deflate64: output larger than declared size")
    return bytes(out)


def read_member(zf: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    """zipfile.read, with a Deflate64 fallback that reads the raw member."""
    if info.compress_type != 9:
        return zf.read(info)
    fp = zf.fp
    fp.seek(info.header_offset)
    hdr = fp.read(30)
    if hdr[:4] != b"PK\x03\x04":
        raise ValueError("bad local header")
    name_len = int.from_bytes(hdr[26:28], "little")
    extra_len = int.from_bytes(hdr[28:30], "little")
    fp.seek(info.header_offset + 30 + name_len + extra_len)
    raw = fp.read(info.compress_size)
    data = inflate64(raw, info.file_size)
    if len(data) != info.file_size or (zlib.crc32(data) & 0xFFFFFFFF) != info.CRC:
        raise ValueError("deflate64: size or CRC mismatch")
    return data


class BatchReader:
    """Opens batch zips lazily (central directory only) and reads members."""

    def __init__(self, cache: str, allow_full_zip: int = 2):
        self.cache = cache
        self.zips: dict[tuple[str, str], tuple[zipfile.ZipFile, dict, HTTPRangeFile | None]] = {}
        self.full_zip_budget = allow_full_zip
        self.other_batches: dict[str, list[str]] = {}  # year -> all batch ids, for lookups
        os.makedirs(os.path.join(cache, "xml"), exist_ok=True)

    def _open(self, year: str, batch: str):
        key = (year, batch)
        if key not in self.zips:
            url = ZIP_URL.format(year=year, batch=batch)
            rf = None
            try:
                rf = HTTPRangeFile(url)
                zf = zipfile.ZipFile(rf)
            except Exception as e:  # range reading failed: limited fallback
                if isinstance(e, urllib.error.HTTPError) or self.full_zip_budget <= 0:
                    raise
                print(f"  range read failed for {url} ({e}); downloading whole zip", file=sys.stderr)
                self.full_zip_budget -= 1
                zdir = os.path.join(self.cache, "zips")
                os.makedirs(zdir, exist_ok=True)
                zf = zipfile.ZipFile(download(url, os.path.join(zdir, f"{batch}.zip")))
            names = {os.path.basename(i.filename): i for i in zf.infolist()}
            print(f"  opened {batch}: {len(names)} members", file=sys.stderr)
            self.zips[key] = (zf, names, rf)
        return self.zips[key]

    def get_xml(self, year: str, batch: str, object_id: str) -> bytes | None:
        if not (SAFE_ID.match(batch) and object_id.isdigit() and year.isdigit()):
            return None
        path = os.path.join(self.cache, "xml", f"{object_id}_public.xml")
        if os.path.exists(path):
            with open(path, "rb") as f:
                return f.read()
        member = f"{object_id}_public.xml"
        zf, names, _ = self._open(year, batch)
        info = names.get(member)
        if info is None:  # index occasionally points at the wrong batch
            for other in self.other_batches.get(year, []):
                if other == batch:
                    continue
                zf, names, _ = self._open(year, other)
                info = names.get(member)
                if info is not None:
                    break
        if info is None or info.file_size > MAX_XML_BYTES:
            return None
        data = read_member(zf, info)
        with open(path + ".part", "wb") as f:
            f.write(data)
        os.replace(path + ".part", path)
        return data

    def stats(self) -> tuple[int, int]:
        reqs = sum(rf.requests for _, _, rf in self.zips.values() if rf)
        got = sum(rf.bytes_fetched for _, _, rf in self.zips.values() if rf)
        return reqs, got


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

SMALL = {"an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "de", "la"}
KEEP_UPPER = {
    "USA", "US", "YMCA", "YWCA", "UMC", "LLC", "LLP", "NA", "II", "III", "IV", "VI", "VII", "VIII",
    "IX", "XI", "SPCA", "PTA", "PTO", "FFA", "NC", "OH", "KY", "UNC", "OSU", "UK", "WKU", "EKU",
    "NKU", "ECU", "UNCW", "NCSU", "CMC", "PNC", "JP", "PBS", "NPR", "WOSU", "WCPN", "WUNC",
    "AME", "CME", "AMVETS", "VFW", "ALS", "CF", "MS", "ARC", "STEM", "KIPP", "HIV", "AIDS",
    "WVXU", "WGUC", "KET", "CCF", "UCLA", "MIT", "YMHA", "JCC", "CYO", "YMI", "BSA", "GSA",
    "LGBT", "LGBTQ", "AARP", "SECU", "TTEE", "UA", "UW", "UC", "OU", "BGSU", "CWRU", "JDRF",
}
ABBREV = {
    "FDN": "Foundation", "FNDN": "Foundation", "FNDTN": "Foundation", "FOUNDATIO": "Foundation",
    "FOUND": "Foundation", "FOUNDATI": "Foundation", "FOUNDAT": "Foundation",
    "CHAR": "Charitable", "CHARITAB": "Charitable", "CHARITABL": "Charitable",
    "MEM": "Memorial", "INC": "Inc", "CORP": "Corp", "CO": "Co", "ASSN": "Association",
    "ASSOC": "Association", "SCHOL": "Scholarship", "TR": "Trust", "TRST": "Trust",
}


def _cap_word(w: str) -> str:
    if not w:
        return w
    if "-" in w and len(w) > 1:
        return "-".join(_cap_word(p) for p in w.split("-"))
    if "/" in w and len(w) > 1:
        return "/".join(_cap_word(p) for p in w.split("/"))
    core = w.strip(".,()'\"")
    if core.upper() in ABBREV and core.isalpha():
        return w.replace(core, ABBREV[core.upper()])
    if core.upper() in KEEP_UPPER:
        return w.upper()
    if 2 <= len(core) <= 4 and core.isalpha() and not re.search(r"[aeiouyAEIOUY]", core) \
            and core.upper() not in {"MR", "MRS", "DR", "ST", "JR", "SR", "MT", "FT", "CT", "LTD", "BLVD", "PL"}:
        return w.upper()  # vowel-less tokens are acronyms: MGM, KFC
    if re.fullmatch(r"[A-Za-z]\.([A-Za-z]\.?)+,?", w):  # initials like J.P.
        return w.upper()
    lw = w.lower()
    m = re.match(r"^([^a-z]*)(mc)([a-z])(.*)$", lw)
    if m and len(lw) > 3:
        return m.group(1) + "Mc" + m.group(3).upper() + m.group(4)
    m = re.match(r"^([^a-z]*)(o')([a-z])(.*)$", lw)
    if m:
        return m.group(1) + "O'" + m.group(3).upper() + m.group(4)
    out = re.sub(r"[a-z]", lambda x: x.group(0).upper(), lw, count=1)
    out = re.sub(r"'S\b", "'s", out)
    return out


def title_case(s: str | None) -> str | None:
    if not s:
        return s
    s = re.sub(r"\s+", " ", s).strip()
    letters = [c for c in s if c.isalpha()]
    if letters and sum(c.islower() for c in letters) / len(letters) > 0.3:  # already mixed case
        return s
    words = s.split(" ")
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if 0 < i < len(words) - 1 and lw in SMALL:
            out.append(lw)
        else:
            out.append(_cap_word(w))
    res = " ".join(out)
    res = re.sub(r"\bInc\b\.?$", "Inc.", res)
    return res


PROPER = re.compile(
    r"\b(january|february|march|april|may 1|june|july|august|september|october|november|december|"
    r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"ohio|kentucky|north carolina|south carolina|indiana|west virginia|virginia|tennessee|pennsylvania|"
    r"michigan|georgia|florida|new york|cleveland|cincinnati|columbus|dayton|toledo|akron|youngstown|"
    r"canton|louisville|lexington|bowling green|charlotte|raleigh|durham|greensboro|winston-salem|"
    r"asheville|wilmington|appalachia|christian|god|jesus|christ|catholic|jewish|"
    r"united way|salvation army|red cross|habitat for humanity)\b")


def sentence_case(s: str | None, limit: int | None = None) -> str | None:
    if s is None:
        return None
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return None
    letters = [c for c in s if c.isalpha()]
    if letters and sum(c.isupper() for c in letters) / len(letters) > 0.8:
        s = s.lower()
        s = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), s)
        s = re.sub(r"\bi\b", "I", s)
        s = PROPER.sub(lambda m: m.group(0).title(), s)
        s = re.sub(r"\b(usa|u\.s\.|irs|ymca|ywca|llc|n/a|501\(c\)\(3\))\b", lambda m: m.group(0).upper(), s)
    if limit and len(s) > limit:
        cut = s[: limit - 1].rsplit(" ", 1)[0].rstrip(",;:- ")
        s = cut + "…"
    return s


NULLISH = {"", "N/A", "NA", "NONE.", "N A", "-", "--", "0", "NOT APPLICABLE", "N/A.", "X", "."}


def clean_text(s: str | None, limit: int = 400) -> str | None:
    if s is None:
        return None
    t = re.sub(r"\s+", " ", s).strip()
    if t.upper() in NULLISH:
        return None
    return sentence_case(t, limit)


ORG_WORD = re.compile(r"\b(foundation|fund|trust|charitable|charities|memorial|endowment|scholarship|"
                      r"association|society|institute|inc|corp|family|fdn|trst|tr)\b", re.I)
CARE_OF = re.compile(r"^\s*(%|c/o\b|co\b|attn\b|ttee\b|trustee\b)", re.I)
TRUSTEE_WORD = re.compile(r"\b(ttee|trustee|bank|n\.?a\.?|wealth|trust company|trust co)\b", re.I)


def join_name_lines(line1: str | None, line2: str | None) -> str | None:
    """Append BusinessNameLine2 only when it continues the name (e.g. 'FAMILY
    FOUNDATION'); drop care-of lines, people and bank trustees. Also strip a
    care-of suffix embedded in line 1 ('... co AMG National Trust Trustee')."""
    if line1:
        line1 = re.sub(r"\s+(c/o|%|co)\s+.*\b(trust|trustee|ttee|bank)\b.*$", "", line1, flags=re.I).strip()
    if not line2 or not line1:
        return line1
    if CARE_OF.match(line2) or TRUSTEE_WORD.search(line2):
        return line1
    dangling = re.search(r"\b(the|and|&|of|for|family|memorial|charitable)$", line1, re.I)
    if ORG_WORD.search(line2) or dangling:
        return f"{line1} {line2}"
    return line1


# A profile on a nonprofit directory or an IRS page is not the foundation's own site: such URLs
# carry the EIN or a profile path.
DIRECTORY_SITES = re.compile(r"(\birs\.gov\b|\b\d{2}-?\d{7}\b|/(profiles?|organizations?|nonprofits?|orgs?|ein|charities|funders?|grantmakers?)/)", re.I)


def normalize_website(s: str | None) -> str | None:
    if not s:
        return None
    t = s.strip().strip("/").lower()
    if t.upper() in NULLISH or t in {"none", "n/a", "na", "no", "www", "http://", "https://"}:
        return None
    t = re.sub(r"^https?:/*", "", t)
    t = re.sub(r"^www\.\s+", "www.", t)
    t = t.split()[0] if t.split() else ""
    if DIRECTORY_SITES.search(t):
        return None
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}(/[^\s]*)?", t):
        return None
    return "https://" + t


def format_phone(s: str | None) -> str | None:
    if not s:
        return None
    d = re.sub(r"\D", "", s)
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    if len(d) != 10 or d == "0" * 10:
        return None
    return f"({d[:3]}) {d[3:6]}-{d[6:]}"


# --------------------------------------------------------------------------
# XML parsing (namespace-agnostic)
# --------------------------------------------------------------------------

def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def strip_ns(root: ET.Element) -> ET.Element:
    for el in root.iter():
        el.tag = local(el.tag)
    return root


def ftext(el: ET.Element | None, *paths: str) -> str | None:
    """First non-empty text among the given ElementPath expressions."""
    if el is None:
        return None
    for p in paths:
        node = el.find(p)
        if node is not None and node.text and node.text.strip():
            return node.text.strip()
    return None


def fnum(el: ET.Element | None, *paths: str) -> float | None:
    t = ftext(el, *paths)
    if t is None:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def parse_990pf(data: bytes) -> dict | None:
    # Untrusted input and stdlib only (no defusedxml): refuse any DTD/entity
    # declarations outright. ElementTree never fetches external entities, and
    # IRS e-file XML never contains a DOCTYPE.
    head = data[:4096]
    if b"<!DOCTYPE" in head or b"<!ENTITY" in data:
        raise ValueError("DOCTYPE/ENTITY not allowed")
    root = strip_ns(ET.fromstring(data))
    header = root.find(".//ReturnHeader")
    pf = root.find(".//IRS990PF")
    if pf is None:
        return None
    filer = header.find(".//Filer") if header is not None else None
    name = ftext(filer, "BusinessName/BusinessNameLine1Txt", "BusinessName/BusinessNameLine1", "Name/BusinessNameLine1")
    line2 = ftext(filer, "BusinessName/BusinessNameLine2Txt", "BusinessName/BusinessNameLine2")
    name = join_name_lines(name, line2)
    addr = filer.find("USAddress") if filer is not None else None
    if addr is None and filer is not None:
        addr = filer.find("AddressUS")
    city = ftext(addr, "CityNm", "City")
    state = ftext(addr, "StateAbbreviationCd", "State")
    zipc = ftext(addr, "ZIPCd", "ZIPCode")
    tax_yr = ftext(header, "TaxYr", "TaxYear")
    if not tax_yr:
        end = ftext(header, "TaxPeriodEndDt", "TaxPeriodEndDate")
        tax_yr = end[:4] if end else None
        if end and end[5:7] and int(end[5:7]) < 12:
            tax_yr = str(int(end[:4]) - 1)

    website = ftext(pf, ".//WebsiteAddressTxt", ".//WebSiteAddressTxt", ".//WebsiteAddress")
    fmv = fnum(pf, "FMVAssetsEOYAmt", ".//FMVAssetsEOYAmt", ".//FairMarketValueOfAllAssets")
    total_xv = fnum(pf, ".//SupplementaryInformationGrp/TotalGrantOrContriPdDurYrAmt", ".//TotalGrantOrContriPdDurYrAmt",
                    ".//TotalGrantOrContriPaidDuringYear")
    contri = fnum(pf, ".//AnalysisOfRevenueAndExpenses/ContriPaidRevAndExpnssAmt", ".//ContriPaidRevAndExpnssAmt",
                  ".//ContriPaidDsbrsChrtblAmt", ".//ContributionsGiftsGrantsPaid")

    pre = ftext(pf, ".//OnlyContriToPreselectedInd", ".//OnlyContributesToPreselected")
    preselected = pre is not None and pre.strip().upper() in {"X", "1", "TRUE", "YES"}

    application = None
    for g in pf.iter("ApplicationSubmissionInfoGrp"):
        person = ftext(g, "RecipientPersonNm", "RecipientPersonName", "RecipientName")
        biz = ftext(g, "RecipientBusinessName/BusinessNameLine1Txt", "RecipientBusinessName/BusinessNameLine1")
        phone = format_phone(ftext(g, "RecipientPhoneNum", "RecipientPhoneNumber", "RecipientForeignPhoneNum"))
        email = ftext(g, "RecipientEmailAddressTxt", "RecipientEmailAddress")
        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", email):
            email = None
        gaddr = g.find("RecipientUSAddress")
        parts = [title_case(person) if person else None, title_case(biz) if biz else None]
        if gaddr is not None:
            line = ", ".join(x for x in [title_case(ftext(gaddr, "AddressLine1Txt", "AddressLine1")),
                                         title_case(ftext(gaddr, "CityNm", "City")),
                                         " ".join(x for x in [ftext(gaddr, "StateAbbreviationCd", "State"),
                                                              (ftext(gaddr, "ZIPCd", "ZIPCode") or "")[:5]] if x)] if x)
            parts.append(line or None)
        parts += [phone, email.lower() if email else None]
        contact = "; ".join(p for p in parts if p) or None
        app = {
            "contact": contact,
            "howTo": clean_text(ftext(g, "FormAndInfoAndMaterialsTxt", "FormAndInfoAndMaterials")),
            "deadlines": clean_text(ftext(g, "SubmissionDeadlinesTxt", "SubmissionDeadlines")),
            "restrictions": clean_text(ftext(g, "RestrictionsOnAwardsTxt", "RestrictionsOnAwards")),
        }
        if any(app.values()):
            application = app
            break

    # Part XV line 2 is filled in only when the preselected box is NOT checked:
    # box checked -> False; unchecked with application info -> True; else None.
    if preselected:
        accepts = False
    elif application is not None:
        accepts = True
    else:
        accepts = None

    grants_org: list[dict] = []
    indiv: list[dict] = []
    for g in root.iter("GrantOrContributionPdDurYrGrp"):
        amt = fnum(g, "Amt", "Amount")
        if amt is None or amt <= 0:
            continue
        purpose = ftext(g, "GrantOrContributionPurposeTxt", "PurposeOfGrantOrContribution")
        biz = " ".join(x for x in [ftext(g, "RecipientBusinessName/BusinessNameLine1Txt",
                                         "RecipientBusinessName/BusinessNameLine1"),
                                   ftext(g, "RecipientBusinessName/BusinessNameLine2Txt",
                                         "RecipientBusinessName/BusinessNameLine2")] if x)
        person = ftext(g, "RecipientPersonNm", "RecipientPersonName")
        status = ftext(g, "RecipientFoundationStatusTxt", "RecipientFoundationStatus")
        if not biz:
            if person:
                indiv.append({"amount": amt, "purpose": purpose})  # name intentionally dropped
            continue
        us = g.find("RecipientUSAddress")
        gcity = ftext(us, "CityNm", "City") if us is not None else None
        gstate = ftext(us, "StateAbbreviationCd", "State") if us is not None else None
        grants_org.append({"name": biz, "city": gcity, "state": gstate, "amount": amt,
                           "purpose": purpose, "status": status})

    officers: list[dict] = []
    seen = set()
    for grp in pf.iter("OfficerDirTrstKeyEmplInfoGrp"):
        for o in grp.iter("OfficerDirTrstKeyEmplGrp"):
            person = ftext(o, "PersonNm", "PersonName")
            biz = ftext(o, "BusinessName/BusinessNameLine1Txt", "BusinessName/BusinessNameLine1")
            title = ftext(o, "TitleTxt", "Title")
            nm = person or biz  # a bank acting as trustee is kept by business name
            if not nm:
                continue
            key = nm.upper()
            if key in seen:
                continue
            seen.add(key)
            officers.append({"name": title_case(nm), "title": title_case(title) if title else None})
            if len(officers) >= 12:
                break

    return {
        "ein": ftext(filer, "EIN"), "name": name, "city": city, "state": state, "zip": zipc,
        "website": website, "taxYear": int(tax_yr) if tax_yr and tax_yr.isdigit() else None,
        "assets": fmv, "totalXV": total_xv, "contri": contri, "accepts": accepts,
        "application": application, "grants": grants_org, "indiv": indiv, "officers": officers[:12],
    }


# --------------------------------------------------------------------------
# Derivations
# --------------------------------------------------------------------------

def focus_labels(grants: list[dict], indiv: list[dict], state: str | None) -> list[str]:
    dollars: Counter = Counter()
    counts: Counter = Counter()
    total = sum(g["amount"] for g in grants) or 1.0
    n = len(grants) or 1
    for g in grants:
        text = f"{g.get('purpose') or ''} {g.get('name') or ''}".lower()
        hit = set()
        for label, (inc, exc) in _COMPILED.items():
            if inc.search(text) and not (exc and exc.search(text)):
                hit.add(label)
        if "Health" in hit and RURAL_CUE.search(text):
            hit.add("Rural health")
        for label in hit:
            dollars[label] += g["amount"]
            counts[label] += 1
    for g in indiv:
        text = (g.get("purpose") or "").lower()
        if re.search(r"scholar|tuition|education|college|student", text):
            dollars["Scholarships"] += g["amount"]
            counts["Scholarships"] += 1
    keep = [lab for lab in dollars
            if dollars[lab] / total >= 0.10 or (counts[lab] >= 2 and counts[lab] / n >= 0.15)]
    keep.sort(key=lambda lab: (-dollars[lab], FOCUS_ORDER.index(lab)))
    if not keep and dollars:
        keep = [max(dollars, key=lambda lab: dollars[lab])]
    return keep[:4]


GENERIC_WORDS = set("""general operating operations support supports fund funds funding purpose purposes use
unrestricted charitable annual campaign expenses expense contribution contributions donation donations gift
gifts program programs see attached statement budget of the for to and a an exempt mission organization
organizational organizations capacity public charity charities 501c3 501 c 3 its their activities ongoing
needs need sustaining sustain continued continuing grant grants general-operating religious educational
scientific literary""".split())


def is_generic(p: str) -> bool:
    words = re.findall(r"[a-z0-9]+", p.lower())
    return not words or all(w in GENERIC_WORDS for w in words)


def purpose_sample(grants: list[dict], k: int = 3) -> list[str]:
    """Up to k distinct, non-generic grant purposes, ordered by dollars."""
    by_dollars: Counter = Counter()
    for g in grants:
        p = re.sub(r"\s+", " ", g.get("purpose") or "").strip()
        if len(p) < 4 or is_generic(p):
            continue
        by_dollars[p.upper()] += g["amount"]
    return [sentence_case(p, 140) for p, _ in by_dollars.most_common(k)]


def build_record(meta: dict, bmf_row: dict, parsed: dict) -> dict:
    grants = parsed["grants"]
    amounts = sorted(g["amount"] for g in grants)
    total_giving = parsed["totalXV"] or parsed["contri"] or (sum(amounts) if amounts else None)
    st_counts = Counter(g["state"] for g in grants if g["state"])
    city_counts = Counter((title_case(g["city"]), g["state"]) for g in grants if g["city"] and g["state"])
    top = sorted(grants, key=lambda g: -g["amount"])[:15]
    state = bmf_row["STATE"]
    ein = re.sub(r"\D", "", parsed.get("ein") or meta["EIN"]).zfill(9)
    zipc = parsed.get("zip") or bmf_row.get("ZIP") or ""
    name = title_case(parsed.get("name") or bmf_row["NAME"])
    return {
        "ein": ein,
        "name": name,
        "city": title_case(parsed.get("city") or bmf_row.get("CITY")),
        "state": state,
        "zip": zipc[:5] if zipc else None,
        "website": normalize_website(parsed.get("website")),
        "taxYear": parsed.get("taxYear") or int(meta["TAX_PERIOD"][:4]),
        "objectId": meta["OBJECT_ID"],
        "batchId": meta["XML_BATCH_ID"],
        "assets": round(parsed["assets"]) if parsed.get("assets") is not None else None,
        "totalGiving": round(total_giving) if total_giving is not None else None,
        "grantCount": len(amounts),
        "grantMedian": round(statistics.median(amounts)) if amounts else None,
        "grantMin": round(amounts[0]) if amounts else None,
        "grantMax": round(amounts[-1]) if amounts else None,
        "acceptsUnsolicited": parsed.get("accepts"),
        "application": parsed.get("application"),
        "focus": focus_labels(grants, parsed["indiv"], state),
        "granteeStates": [{"state": s, "count": c} for s, c in sorted(st_counts.items(), key=lambda x: (-x[1], x[0]))],
        "granteeCities": [{"city": c, "state": s, "count": n}
                          for (c, s), n in sorted(city_counts.items(), key=lambda x: (-x[1], x[0]))[:5]],
        "officers": parsed.get("officers") or [],
        "purposeSample": purpose_sample(grants),
        "grantees": [{"name": title_case(g["name"]), "city": title_case(g["city"]), "state": g["state"],
                      "amount": round(g["amount"]), "purpose": sentence_case(g["purpose"], 140)} for g in top],
    }


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def load_bmf(cache: str, states: list[str]) -> dict[str, dict]:
    bmf = {}
    for st in states:
        path = download(BMF_URL.format(st=st.lower()), os.path.join(cache, f"eo_{st.lower()}.csv"))
        with open(path, newline="", encoding="latin-1") as f:
            for r in csv.DictReader(f):
                if r.get("FOUNDATION") == "04" and r.get("STATE") == st:
                    bmf[r["EIN"]] = r
    return bmf


def load_index(cache: str, years: list[str], bmf: dict) -> dict[str, dict]:
    newest: dict[str, dict] = {}
    for y in years:
        path = download(INDEX_URL.format(year=y), os.path.join(cache, f"index_{y}.csv"))
        with open(path, newline="", encoding="latin-1") as f:
            for r in csv.DictReader(f):
                if r.get("RETURN_TYPE") != "990PF" or r.get("EIN") not in bmf:
                    continue
                r["YEAR"] = y
                # 2024 index has ids like 2024_TEOS_XML_05a; the zip URL is upper case.
                r["XML_BATCH_ID"] = r["XML_BATCH_ID"].upper()
                key = (r["TAX_PERIOD"], r["OBJECT_ID"])
                cur = newest.get(r["EIN"])
                if cur is None or key > (cur["TAX_PERIOD"], cur["OBJECT_ID"]):
                    newest[r["EIN"]] = r
    return newest


def asset_amt(row: dict) -> float:
    try:
        return float(row.get("ASSET_AMT") or 0)
    except ValueError:
        return 0.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", required=True, help="cache directory for downloads (outside the repo)")
    ap.add_argument("--states", default="OH,KY,NC")
    ap.add_argument("--years", default="2025,2024", help="e-file index years; newest return per EIN wins")
    ap.add_argument("--out", default="src/data/foundations.json")
    ap.add_argument("--targets", default="OH:150,NC:130,KY:110", help="per-state target counts")
    ap.add_argument("--min-grants", type=int, default=3)
    ap.add_argument("--min-giving", type=float, default=20000)
    ap.add_argument("--max-fetch", type=int, default=1500, help="safety cap on XML fetches")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    states = [s.strip().upper() for s in args.states.split(",") if s.strip()]
    years = [y.strip() for y in args.years.split(",") if y.strip()]
    targets = {k: int(v) for k, v in (t.split(":") for t in args.targets.split(","))}
    os.makedirs(args.cache, exist_ok=True)

    print("loading BMF extracts", file=sys.stderr)
    bmf = load_bmf(args.cache, states)
    print(f"  {len(bmf)} private non-operating foundations", file=sys.stderr)
    print("loading e-file indexes", file=sys.stderr)
    idx = load_index(args.cache, years, bmf)
    print(f"  {len(idx)} with a 990-PF in {years}", file=sys.stderr)

    rng = random.Random(args.seed)
    reader = BatchReader(args.cache)
    for m in idx.values():
        lst = reader.other_batches.setdefault(m["YEAR"], [])
        if m["XML_BATCH_ID"] not in lst:
            lst.append(m["XML_BATCH_ID"])
    records: list[dict] = []
    fetched = 0
    skipped = Counter()

    for st in states:
        target = targets.get(st, 100)
        pool = sorted((m for m in idx.values() if bmf[m["EIN"]]["STATE"] == st), key=lambda m: m["EIN"])
        bands: list[list[dict]] = []
        for lo, hi, _ in BANDS:
            b = [m for m in pool if lo <= asset_amt(bmf[m["EIN"]]) < hi]
            rng.shuffle(b)
            bands.append(b)
        quotas = [round(target * w) for _, _, w in BANDS]
        got = [0] * len(BANDS)
        kept = 0

        def try_one(m: dict) -> bool:
            nonlocal fetched
            fetched += 1
            try:
                data = reader.get_xml(m["YEAR"], m["XML_BATCH_ID"], m["OBJECT_ID"])
                if not data:
                    skipped["missing"] += 1
                    return False
                parsed = parse_990pf(data)
            except Exception as e:  # tolerate bad members, keep going
                skipped["error"] += 1
                print(f"  error {m['OBJECT_ID']}: {e}", file=sys.stderr)
                return False
            if not parsed:
                skipped["not990pf"] += 1
                return False
            rec = build_record(m, bmf[m["EIN"]], parsed)
            if rec["grantCount"] < args.min_grants:
                skipped["fewGrants"] += 1
                return False
            if (rec["totalGiving"] or 0) < args.min_giving:
                skipped["lowGiving"] += 1
                return False
            records.append(rec)
            return True

        # pass 1: per-band quotas
        for i, b in enumerate(bands):
            while b and got[i] < quotas[i] and fetched < args.max_fetch:
                if try_one(b.pop()):
                    got[i] += 1
                    kept += 1
        # pass 2: fill remaining quota round-robin from bands with candidates left
        while kept < target and any(bands) and fetched < args.max_fetch:
            for i, b in enumerate(bands):
                if b and kept < target and try_one(b.pop()):
                    got[i] += 1
                    kept += 1
        print(f"  {st}: kept {kept} (by band {got}), fetched so far {fetched}", file=sys.stderr)

    records.sort(key=lambda r: (states.index(r["state"]), r["name"] or ""))
    reqs, nbytes = reader.stats()
    print(f"range requests {reqs}, {nbytes / 1e6:.1f} MB fetched; skipped {dict(skipped)}", file=sys.stderr)

    out = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": {
            "description": ("US private non-operating foundations (IRS foundation code 04) from the IRS Exempt "
                            "Organizations Business Master File, with giving and application details parsed from "
                            "each foundation's most recent Form 990-PF e-file XML. Public domain U.S. government data."),
            "license": "Public domain (U.S. federal government work)",
            "bmf": [BMF_URL.format(st=s.lower()) for s in states],
            "efileIndex": [INDEX_URL.format(year=y) for y in years],
            "efileXml": "https://apps.irs.gov/pub/epostcard/990/xml/<YEAR>/<XML_BATCH_ID>.zip (member <OBJECT_ID>_public.xml)",
            "criteria": {"foundationCode": "04", "returnType": "990PF", "minOrgGrants": args.min_grants,
                         "minTotalGiving": args.min_giving},
        },
        "states": states,
        "foundations": records,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(records)} foundations to {args.out} ({os.path.getsize(args.out) / 1e6:.2f} MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
