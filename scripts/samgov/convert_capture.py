"""
Turn a keyless SAM.gov capture (search results plus notice details, saved as
JSON from sam.gov's public site endpoints) into the shape the official
Opportunities API v2 returns, so the demo replays through the same code the
live search uses. Nothing is invented: fields the capture lacks stay null.

  python3 -I scripts/samgov/convert_capture.py CAPTURE_DIR OUT.json
"""
import html
import json
import re
import sys
from pathlib import Path

TYPES = {"p": "Presolicitation", "o": "Solicitation", "k": "Combined Synopsis/Solicitation", "r": "Sources Sought", "s": "Special Notice", "a": "Award Notice", "u": "Justification", "i": "Intent to Bundle Requirements (DoD-Funded)", "g": "Sale of Surplus Property"}
SET_ASIDES = {
    "SBA": "Total Small Business Set-Aside (FAR 19.5)", "SBP": "Partial Small Business Set-Aside (FAR 19.5)", "8A": "8(a) Set-Aside (FAR 19.8)", "8AN": "8(a) Sole Source (FAR 19.8)",
    "HZC": "HUBZone Set-Aside (FAR 19.13)", "HZS": "HUBZone Sole Source (FAR 19.13)", "SDVOSBC": "Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)",
    "SDVOSBS": "Service-Disabled Veteran-Owned Small Business (SDVOSB) Sole Source (FAR 19.14)", "WOSB": "Women-Owned Small Business (WOSB) Program Set-Aside (FAR 19.15)",
    "EDWOSB": "Economically Disadvantaged WOSB (EDWOSB) Program Set-Aside (FAR 19.15)", "VSA": "Veteran-Owned Small Business Set-Aside (specific to Department of Veterans Affairs)",
}


def text_of(body: str) -> str:
    body = (body or "").replace("Â", "")
    body = re.sub(r"<\s*(br|/p|/li|/div|/h\d)\s*/?>", "\n", body, flags=re.I)
    body = re.sub(r"<[^>]+>", "", body)
    body = html.unescape(body)
    body = re.sub(r"[ \t ]+", " ", body)
    return re.sub(r"\n\s*\n+", "\n\n", body).strip()


def main(src: Path, out: Path) -> None:
    paths = {}
    for f in sorted((src / "searches").glob("*.json")):
        d = json.loads(f.read_text())
        for r in d.get("_embedded", {}).get("results", []):
            hier = sorted(r.get("organizationHierarchy") or [], key=lambda x: x.get("level", 0))
            paths[r["_id"]] = (".".join(h["name"] for h in hier), (r.get("type") or {}).get("value"), r.get("parentNoticeId"))
    notices = []
    for f in sorted((src / "details").glob("*.json")):
        d = json.loads(f.read_text())
        nid = d.get("id") or d.get("opportunityId")
        b = d.get("data2") or {}
        sol = b.get("solicitation") or {}
        naics = next((n["code"][0] for n in b.get("naics") or [] if n.get("type") == "primary" and n.get("code")), None)
        pop = b.get("placeOfPerformance") or {}
        code = sol.get("setAside")
        path, type_label, parent = paths.get(nid, (None, None, None))
        desc = (d.get("description") or [{}])[0].get("body", "")
        notices.append({
            "noticeId": nid,
            "title": (b.get("title") or "").strip(),
            "solicitationNumber": (b.get("solicitationNumber") or "").strip() or None,
            "fullParentPathName": path,
            "postedDate": (d.get("postedDate") or "")[:10] or None,
            "type": type_label or TYPES.get(b.get("type"), b.get("type")),
            "baseType": TYPES.get(b.get("type"), b.get("type")),
            "typeOfSetAside": code if code and code != "NONE" else None,
            "typeOfSetAsideDescription": SET_ASIDES.get(code) if code and code != "NONE" else None,
            "responseDeadLine": (sol.get("deadlines") or {}).get("response"),
            "naicsCode": naics,
            "classificationCode": b.get("classificationCode"),
            "active": "Yes" if d.get("latest", True) and not d.get("archived") and not d.get("cancelled") else "No",
            "pointOfContact": [{"type": p.get("type"), "fullName": p.get("fullName"), "email": p.get("email"), "phone": p.get("phone"), "title": p.get("title")} for p in b.get("pointOfContact") or []],
            "placeOfPerformance": {"city": pop.get("city") or None, "state": pop.get("state") or None, "zip": pop.get("zip") or None, "country": pop.get("country") or None},
            "description": f"https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid={nid}",
            "uiLink": f"https://sam.gov/opp/{nid}/view",
            # The official search returns the description as a link; the capture includes the text it points to.
            "descriptionText": text_of(desc),
        })
    out.write_text(json.dumps({"recordedAt": "2026-10-18", "source": "sam.gov public search and notice pages, mapped to Opportunities API v2 fields", "opportunitiesData": notices}, indent=1, ensure_ascii=False))
    print(f"{len(notices)} notices written to {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
