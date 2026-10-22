# Adding a state or local procurement source

FundFellows lists open public bids (invitations for bids, requests for proposals, requests for
qualifications, highway lettings) from state and local governments. Each portal is one config entry in
`src/lib/catalog/connectors/state-local.ts`. The entry becomes one connector, with its own source id,
schedule, and row on the /data page.

This guide covers the checks to run before adding a portal, the config fields, and how to test it.

## 1. Check that the portal can be reused

Add a portal only when all of these hold:

1. **It lists open solicitations.** A list of awarded contracts or spending is not a bid source. Forecasts
   of upcoming solicitations are fine; they are stored as `forecasted`.
2. **It publishes them in a documented, reusable format.** Use one of these:
   - a Socrata dataset (the SODA API that most city and state open data portals run on), or
   - an official RSS, Atom, CSV, or JSON feed that the government publishes for reuse.

   Never parse HTML pages. If the only way to get the data is to read web pages, leave the portal out.
3. **Its terms allow reuse and automated access.** Read the portal's terms of use and the dataset's license.
   Look for an open data law, a public domain or open license (CC0, PDDL, public domain), or terms that
   place no restriction on use. If the terms forbid automated access, scripts, or bots, leave it out or add
   it with `enabled: false` and say why in `notes`.
4. **robots.txt allows the API path.** Socrata portals allow `/resource/`. All requests go through the
   shared polite fetch, which checks robots.txt, identifies us, waits between requests, and retries.
5. **Each record links to a public page.** Use the record's own page when the portal has one. When it does
   not, link to the record through the API (`sodaRecordUrl`) and say so in the notes.

Record what you find (docs URL, terms URL, a short quote of the reuse clause, update frequency, row counts,
time zone of the dates) in the source's `notes` and in the pull request.

## 2. Find the dataset

For Socrata, the discovery API lists datasets across every portal:

```
https://api.us.socrata.com/api/catalog/v1?q=solicitations&only=dataset
https://api.us.socrata.com/api/catalog/v1?domains=data.example.gov&q=bid
```

Then look at the columns and a few rows:

```
https://data.example.gov/api/views/<dataset-id>.json      (columns, license, update frequency)
https://data.example.gov/resource/<dataset-id>.json?$limit=5
```

Check three things before writing the mapping:

- **Time zone of timestamps.** Socrata stores most timestamps without a zone. Compare the hours of the due
  dates: local business hours (10:00, 14:00) mean local time; odd hours such as 19:00, 21:00, or 07:59 mean
  UTC. Pass the right zone to `zonedTimestamp`.
- **Placeholder dates.** Some portals use 2099-12-31 or 9999-09-09 for "no fixed date".
  `placeholderDate()` detects these; store them as open-ended (`closeAt: null`, a `closeText`).
- **Repeated notices.** Some portals publish a new row for each extension or re-advertisement. Use
  `groupKey` so they become one opportunity.

## 3. Write the config entry

A Socrata portal looks like this:

```ts
export const exampleBids: SocrataPortal = {
  kind: "socrata",
  domain: "data.example.gov",
  dataset: "abcd-1234",
  source: source({
    id: "state_xx_example_bids",          // state_<st>_<portal>, lower case
    name: "Example City open bids",
    covers: "One plain sentence for the /data page.",
    homepage: "https://example.gov/purchasing",
    docsUrl: "https://data.example.gov/d/abcd-1234",
    termsUrl: "https://data.example.gov/terms",
    license: "Public domain",
    attribution: "Source: City of Example, via data.example.gov",
    region: "local",                       // "state" or "local"
    cadence: "Daily",
    schedule: "30 12 * * *",               // GitHub Actions cron, UTC
    enabled: true,
    priority: 20,                          // the agency's own listing
  }),
  where: (now) => `due_date > '${soqlTime(ago(now, 30))}'`,  // everything live plus 30 days of closed
  order: "solicitation_id ASC",            // stable, so paging never skips rows
  map: (row, now) => { ... return { opportunity, funder, parentFunder }; },
};
```

Then add it to the `portals` list at the bottom of the file.

A feed portal uses `feedConnector` from `_feeds.ts` instead:

```ts
feedConnector({ kind: "feed", format: "rss", url: "https://example.gov/bids.xml", source, map });
```

RSS and Atom items arrive as flat records (`title`, `link`, `description`, `pubdate`, `category`, and so
on); CSV rows arrive keyed by column header; JSON uses `itemsPath` to find the array.

### What the mapping must set

| Field | How |
| --- | --- |
| `type` | Always `contract` (use `bidBase(source)`). |
| `sourceId` | The portal's stable id for the record. |
| `sourceUrl` | The record's public page. |
| `opportunityNumber` | The official solicitation number, when there is one. |
| `title`, `summary` | Clean text (`cleanText`). Strip portal prefixes such as "Bid Extension:". |
| `noticeType` | `noticeTypeFrom(type, title)`: invitation_for_bids, request_for_proposals, request_for_qualifications, request_for_quotes, request_for_information, letting, forecast, or solicitation. |
| `postedAt`, `closeAt` | `closeAt` with its zone: `zonedTimestamp(value, "America/Chicago")`, or `endOfDay(day, zone)` when only the day is known (add a `closeText` saying so). |
| `status` | `bidStatus(...)`: open only when the due date is in the future or the portal says the bid is open; cancelled when the portal says so; forecasted for expected solicitations. |
| `categories` | The portal's own category and commodity codes, plus `aecCategories(...)` (adds "construction" or "architecture and engineering" when the record clearly is). |
| `naics` | Leave empty unless a published crosswalk maps the portal's codes (NIGP, UNSPSC) to NAICS. |
| `setAside` | `setAsideFrom(text)` for M/WBE, DBE, SBE, LBE, SDVOB, Section 3; pass program flags as extras. Run free text through `setAsideSentences` first so outreach boilerplate is not read as a set-aside. |
| `place` | `{ state, city }`, plus `text` for a county or site. |
| `contact` | The procurement contact as published. |
| `attachments` | Links only, when the portal gives document URLs. |

### Funders

The buying agency is the funder. Keys follow these patterns:

- state agency: `state:<ST>:<slug>` via `stateAgency(st, name, url)`
- local government: `local:<ST>:<place>` via `localGovernment(...)`
- a department of it: `local:<ST>:<place>:<slug>` via `localDepartment(parent, ...)`

Return the department as `funder` and the government as `parentFunder`; the reader emits them before the
opportunity.

### What never to store

- Names of contract winners. Skip award notices and columns such as "awarded vendor" or "architect of record".
- Raw payloads or full documents. Keep links.
- Anything not in the source. If a field is missing, leave it null.

## 4. Test it

Record a few real rows from the portal into `tests/fixtures/catalog/<source-id>/` (keep each file under
200 KB) and add cases to `tests/catalog/state-local.spec.ts`. Cover status rules (open, closed, cancelled,
forecasted), time zones, grouping, funder keys, construction detection, and one malformed record. Run:

```
BASE_URL=http://127.0.0.1:9 npx playwright test tests/catalog/state-local.spec.ts
npx tsc --noEmit
npx eslint src/lib/catalog/connectors/state-local.ts
```

Then run it once against the local database and look at the rows:

```
npx tsx --tsconfig tsconfig.json scripts/ingest.ts state_xx_example_bids --mode backfill --env .env.localdb
```

## 5. Size and cadence

Bid portals are small (tens to a few thousand live records). Keep the `where` filter to live records plus a
short window of recently closed ones, so a backfill sees every live record and `fullSnapshot` can close
the ones that left the portal. Pick a schedule that matches the portal's own refresh; daily is enough for
nearly all of them.
