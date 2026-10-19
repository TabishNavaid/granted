# Foundations dataset

`src/data/foundations.json` lists private grantmaking foundations in Ohio, Kentucky and North Carolina, built from public IRS data by `scripts/foundations/build_foundations.py`.

## Sources

All sources are U.S. federal government works in the public domain. No paid or license-restricted source is used.

- IRS Exempt Organizations Business Master File (BMF) state extracts: [eo_oh.csv](https://www.irs.gov/pub/irs-soi/eo_oh.csv), [eo_ky.csv](https://www.irs.gov/pub/irs-soi/eo_ky.csv), [eo_nc.csv](https://www.irs.gov/pub/irs-soi/eo_nc.csv). Used for the foundation list (FOUNDATION code `04`, private non-operating foundation), the state, and asset size for sampling.
- IRS Form 990-series e-file index: [index_2025.csv](https://apps.irs.gov/pub/epostcard/990/xml/2025/index_2025.csv) and [index_2024.csv](https://apps.irs.gov/pub/epostcard/990/xml/2024/index_2024.csv). Rows with `RETURN_TYPE` `990PF` are kept, newest return per EIN.
- IRS 990 e-file XML batch zips: `https://apps.irs.gov/pub/epostcard/990/xml/<YEAR>/<XML_BATCH_ID>.zip`. The script reads only the needed member (`<OBJECT_ID>_public.xml`) through HTTP Range requests, so whole zips are not downloaded.

## Selection

A foundation is included when it has FOUNDATION code `04` in the BMF for one of the states, filed a 990-PF in the index years, paid at least 3 grants to organizations in that tax year, and paid at least $20,000 in total. Candidates are drawn per state across five asset bands (BMF `ASSET_AMT`: $0.3M to $1M, $1M to $5M, $5M to $25M, $25M to $100M, over $100M) in a fixed shuffled order (`--seed`), so sizes are spread and the output is reproducible. Per-state targets are set with `--targets`.

## Fields

Extracted from the 990-PF XML (elements are matched by local name, so schema years differ without breaking):

- `ein`, `name`, `city`, `state`, `zip`, `website` (normalized to `https://`, directory sites dropped), `taxYear`, `objectId`, `batchId`.
- `assets`: fair market value of assets at end of year (`FMVAssetsEOYAmt`).
- `totalGiving`: Part XV total grants paid (`TotalGrantOrContriPdDurYrAmt`), else Part I contributions paid (`ContriPaidRevAndExpnssAmt`), else the sum of listed grants.
- `acceptsUnsolicited`: `false` when the "only contributes to preselected organizations" box (`OnlyContriToPreselectedInd`) is checked. When it is not checked, `true` if Part XV line 2 application info was filed (the form asks for it only in that case), otherwise `null`.
- `application`: Part XV line 2 (`ApplicationSubmissionInfoGrp`): `contact` (name, address, phone, email as filed), `howTo`, `deadlines`, `restrictions`. `null` when nothing was filed.
- `officers`: up to 12 officers, directors and trustees (`OfficerDirTrstKeyEmplGrp`), `{name, title}`. Compensation is not stored. A bank acting as trustee is kept under its business name.
- Grants paid during the year (`GrantOrContributionPdDurYrGrp`). Grants to individuals are not stored and their names are never read into the output; they only count toward the Scholarships label.

Derived from grants to organizations:

- `grantCount`, `grantMedian`, `grantMin`, `grantMax`.
- `granteeStates` (`{state, count}`, most first) and `granteeCities` (top 5 `{city, state, count}`).
- `grantees`: the 15 largest grants, `{name, city, state, amount, purpose}`, purpose trimmed to 140 characters.
- `purposeSample`: up to 3 distinct grant purposes, ranked by dollars, skipping generic ones such as "general operating support".
- `focus`: 1 to 4 labels from a fixed list (Youth development, Education, Food security, Health, Rural health, Human services, Housing, Arts and culture, Environment, Community development, Religion, Animals, Scholarships). Each grant's purpose and recipient name are matched against keyword rules (`FOCUS_RULES` in the script). A label is kept when its matched grants are at least 10% of grant dollars, or at least 15% of grants (and at least 2). Rural health needs a health match plus a rural cue such as "rural", "critical access" or "county hospital".

Names and long all-caps text are converted to title case or sentence case. Some proper nouns in sentence-cased text stay lowercase.

When the app loads the file, `src/lib/foundations/names.ts` turns IRS trust names into the form people write: surname-first names are put in order ("Black Ann D Charitable Ochr" becomes "Ann D Black Charitable Trust"), and trust-instrument codes (UW, UA, TW, Ta, Ochr, PFDN), account numbers, "aka" and "c/o" tails, and bank trustees are dropped. The name exactly as filed stays on the record as `filedName` and is what the IRS lookup link uses. A name the rules get wrong goes in its `FIXES` table.

## Known limits

- One tax year per foundation: the newest 990-PF found in the index years. Giving varies year to year.
- IRS data lags. A return filed in 2025 usually covers tax year 2024 or 2023, so figures are 1 to 2 years old.
- Many foundations check "only contributes to preselected organizations" (`acceptsUnsolicited: false`). They may still be worth knowing, but they do not take applications.
- Some filers list grants only in a PDF attachment, which is not in the XML. They have few or no parsed grants and are excluded by the 3-grant rule.
- Focus labels are keyword rules over short purpose text and recipient names. They are a rough guide, not a classification by the foundation.
- Application text is copied as filed and can be terse or out of date.
- Grantee city and state come from the recipient address as filed, which can be a mailing address.

## Refresh

From the repo root, with Python 3.10 or newer (standard library only):

```sh
mkdir -p /tmp/irs-cache
python3 -I scripts/foundations/build_foundations.py \
  --cache /tmp/irs-cache \
  --states OH,KY,NC \
  --years 2025,2024 \
  --targets OH:150,NC:130,KY:110 \
  --out src/data/foundations.json
```

The cache directory holds the BMF extracts, the index files (about 90 MB each) and the extracted XML members, so later runs only fetch what is missing. Keep it outside the repo. To move to a newer filing year, put it first in `--years` (for example `--years 2026,2025`); the newest return per EIN wins. A run with an empty cache makes several hundred sequential range requests and takes roughly 10 to 20 minutes.
