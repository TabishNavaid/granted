# Data for firms, research teams, and individuals

Everything below is public. Nothing here costs money or needs a paid key.

## SAM.gov (firms)

- **Live:** the official Opportunities API v2, `https://api.sam.gov/opportunities/v2/search`, with a free public key from a SAM.gov account (`SAM_GOV_API_KEY`). Searches run per NAICS code for notices posted in the last 90 days (`src/lib/samgov`). The description behind each notice's `description` link is fetched with the same key.
- **Demo:** `src/lib/replay/recordings/firm.samgov.json` holds 13 real notices captured on 2026-10-18 from sam.gov's public search and notice pages and mapped field by field to the v2 shape by `scripts/samgov/convert_capture.py`. Fields the capture did not have stay empty. The demo shows the date it was recorded.
- **Refresh:** capture search results and notice details into a folder (`searches/*.json`, `details/*.json`), then `python3 -I scripts/samgov/convert_capture.py <folder> src/lib/replay/recordings/firm.samgov.json`.

## The sample solicitation

`src/lib/replay/recordings/firm-rfp.ts` is the text of a real, public SAM.gov notice: Department of Veterans Affairs, Network Contract Office 17, "NCO 17 AE Short Selection Database FY24 - FY27", solicitation 36C25723R0049, with amendments A0001 to A0003, extracted from the attachments posted on SAM.gov. It is a work of the U.S. government. The notice also posts a list of the firms already in the database; that list is deliberately left out. The response date (2027-09-30) comes from the notice on SAM.gov after amendment A0003.

## Grants.gov (firms and research teams)

`src/lib/segments/searches.ts` lists the exact searches each kind of applicant runs, with its eligibility codes (small businesses and for-profit organizations for firms; higher education for research teams). Live, they run against the free Grants.gov API; in the demo they replay `firm.grantsgov.json` and `lab.grantsgov.json`. Refresh the firm capture with `GEMINI_API_KEY=capture-only npx tsx --tsconfig tsconfig.json scripts/replay/capture-segments.ts firm` (the variable only turns replay off). The lab capture was taken with the same searches by hand on 2026-10-18.

Firm grants are matched by plain rules: the notice must be open, list small businesses, for-profit organizations, or unrestricted eligibility, and be about building, energy, workforce, or small business innovation work (in its title, or twice in its description). Research programs (other than SBIR and STTR), clinical and biomedical programs, and energy technology programs are set aside with the reason shown. Such grants are rare for design and construction firms, and the product says so.

## NSF and NIH funded projects (research teams)

- NSF Award Search API, `https://api.nsf.gov/services/v1/awards.json`, phrase search on the team's keywords, awards active in the last four years. No key.
- NIH RePORTER API v2, `https://api.reporter.nih.gov/v2/projects/search`, text search over titles, terms, and abstracts for the last three fiscal years. No key.
- Live outside the demo (`src/lib/research`); the demo replays `lab.analogs.json`, captured 2026-10-18 for "harmful algal bloom" (NSF) and "harmful algal bloom" or cyanotoxin (NIH).
- SBIR.gov's API returned errors when this was built, so SBIR and STTR notices come through Grants.gov.

## Funders' AI rules

`src/lib/research/policies.ts` summarizes what NIH, NSF, DOE Office of Science, NASA SMD, USDA NIFA, the Department of Education, and the Department of Defense say about AI in proposals, each with its source links and dates, checked 2026-10-18. Recheck it when a funder issues a new notice.

## Scholarships (individuals)

Scholarship funds come from the same IRS 990-PF dataset as private foundations (docs/foundations-data.md): Ohio, Kentucky, and North Carolina for now. A foundation counts only if its name or focus says scholarships or at least 30 percent of its listed grants are scholarship awards; funds limited to another county and educational loans are flagged and ranked down.

## Samples

The firm (Cibolo Line Architecture + Engineering, San Antonio), the lab (Lake Erie Freshwater Systems Lab, Maumee Bay State University), and the student (Jordan Reyes, Dayton) are fictional, as are their clients, people, and projects. Their websites and résumé are made up and live in `src/lib/replay/recordings`.
