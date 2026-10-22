# Data sources

FundFellows (fundfellows.com) keeps one opportunity database for grants, public bids, research funding, and scholarships. This page lists every source in it: what each one covers, how we read it, what its terms allow, what we store, and what we leave out.

## The rules

- Every record links to its official page and shows the date we last checked it.
- The AI never adds a funder, a deadline, or an amount from memory. If a source does not say it, we do not show it. A missing field stays empty.
- We use only sources whose terms allow reuse in a free product. We record the terms page and the license for each one.
- We keep to each source's published rate limits and to its robots.txt. Our requests identify themselves as FundFellowsBot with a contact address, wait between calls to the same host, and back off when a server asks us to slow down.
- We never scrape a site whose terms forbid it. When a portal offers no API, official file, or open dataset, and its pages are the only way in, we leave it out.
- Past contract awards are kept only as totals and typical sizes. We never store or show who won a contract.
- We never store the names of individuals who received a grant or scholarship. Foundation grants to organizations (other nonprofits, schools, and so on) are public in the filing and are kept.
- We keep long documents as links. We do not store raw copies of source pages or files.

Counts on this page come from a test load on October 22, 2026. They show the size of each source, not a live total.

## How refresh works

### Scheduled jobs

Ingestion runs as scheduled GitHub Actions jobs, outside the web app. There are four slots:

| Slot | When (UTC) | What runs |
| --- | --- | --- |
| Hourly | 25 minutes past each hour | SAM.gov contract opportunities |
| Daily | 09:15 | Grants.gov, the Federal Register, NIH Guide, NSF opportunities, SBIR.gov solicitations, state and local bids, international sources, private foundations, and a full read of SAM.gov contract opportunities |
| Weekly | Sunday 06:40 | Past award totals, SAM.gov Assistance Listings, hand-checked scholarships, Illinois CDB forecasts |
| Monthly | 05:00 on the 1st | The IRS exempt organization registry |

Each source declares its own schedule, and that schedule decides its slot. A source that changes hourly goes in the hourly slot. A source that publishes once a week goes in the weekly slot. We can also run any source by hand.

### Full snapshots and incremental reads

Some sources give us their whole live list on every read: Grants.gov, SAM.gov, NIH Guide, NSF opportunities, SBIR.gov solicitations, the state and local open data portals, the EU portal, both UK services, the World Bank, and the hand-checked scholarships. In their scheduled slot these run as a full read. After a full read finishes without errors, any open notice we did not see again is closed. That is how a notice the source withdrew leaves the database.

Other sources run as incremental reads: they ask only for what changed since the last successful run, with a short overlap so nothing falls between runs.

After every run, any notice whose deadline passed more than a day ago is marked closed, unless it accepts applications on a rolling basis.

### The ingestion log

Every run writes a row to an ingestion log: the source, full or incremental, when it started and finished, how many rows it saw, added, updated, and closed, how many funders and award rows it wrote, and any errors. A run that hits a bad record logs it and carries on. A run that fails leaves the existing data in place.

### Dedupe across sources

The same opportunity often appears in more than one place. A National Institutes of Health notice is on Grants.gov and in the NIH Guide. A Department of Education competition is on Grants.gov and in the Federal Register.

- The same official opportunity number means the same opportunity. We normalize numbers before comparing them (case, spaces, punctuation), and we use them only when they are distinctive enough to be safe. Short or generic numbers fall back to a key built from the title, the agency, and the deadline.
- Each source has a priority. When two sources list the same opportunity, the higher-priority source is primary. Grants.gov is first. An agency's own site comes next. Aggregated listings come after.
- The other sources stay attached to the primary record and are shown on it as "also listed on", each with its own link.
- UK notices use a key made from the buyer and the buyer's reference, so a notice on both UK services merges, and a short UK reference never matches a U.S. one.

## Federal grants and programs

### Grants.gov

- **Covers:** Every federal grant and cooperative agreement notice, forecasts included, from all 26 federal grant-making agencies.
- **How we read it:** The official daily XML extract, one file that holds every synopsis and forecast. When you open a notice, the app also asks the Grants.gov API for its current detail.
- **Documentation:** https://www.grants.gov/xml-extract
- **Terms:** https://www.grants.gov/policies. Grants.gov content is a U.S. government work and is in the public domain.
- **Attribution we show:** Source: Grants.gov
- **Refresh:** Daily, as a full read.
- **Key needed:** None.
- **What we store:** Title, opportunity number, agency, dates (posted, close, archive), award ceiling and floor, expected number of awards, eligibility, categories, Assistance Listing numbers, a summary, the grantor contact as published, and the link to the notice.
- **What we do not store:** Closed notices older than three years. They are counted and skipped.
- **Known limits:** Grants.gov keeps a forecast listed until its archive date even when its estimated dates have passed. We follow the source and show it as forecasted.
- **On a test load on October 22, 2026:** 11,282 notices, 811 open and 465 forecasted. The rest are closed notices from the last three years.

### SAM.gov Assistance Listings

- **Covers:** Every federal grant and cooperative agreement program in the Assistance Listings catalog (formerly CFDA), with objectives, who may apply, and typical award ranges.
- **How we read it:** The public Assistance Listings extract from SAM.gov Data Services (an official bulk file, no key).
- **Documentation:** https://sam.gov/data-services/Assistance%20Listings/datagov?privacy=Public
- **Terms:** https://sam.gov/content/about/terms-of-use. The terms say "Most material on our site is free of copyright." Listings are U.S. government works.
- **Attribution we show:** Source: SAM.gov Assistance Listings
- **Refresh:** Weekly, as a full read. The run skips the download when the file has not changed.
- **Key needed:** None.
- **What we store:** One record per program: listing number, title, agency, objectives, who may apply, deadline text, the stated award range, the newest year's estimated obligations, average award when given, the headquarters email and phone, and the program website.
- **What we do not store:** Loan, insurance, service, and benefit-only programs. Programs whose listing says they take no new applications are left out of the open list.
- **Known limits:** A listing describes a program, not a single call. Most programs have no fixed deadline in the catalog, so we show them as programs with the deadline text as written. The actual call, when there is one, usually comes from Grants.gov.
- **On a test load on October 22, 2026:** 2,608 programs.

### Federal Register

- **Covers:** Funding notices federal agencies publish in the Federal Register, such as notices of funding opportunity and applications for new awards, with deadlines read from each notice.
- **How we read it:** The FederalRegister.gov API (version 1) and the full-text links the API returns. We search with a set of funding phrases and keep only notices whose title and summary announce money someone can apply for.
- **Documentation:** https://www.federalregister.gov/developers/documentation/api/v1
- **Terms:** https://www.federalregister.gov/reader-aids/government-policy-and-ofr-procedures/about-this-site. Under 1 CFR 2.6, "Any person may reproduce or republish any material" in the Federal Register. The one restriction is on using official logos and seals, which we do not use.
- **Attribution we show:** Source: FederalRegister.gov, Office of the Federal Register
- **Refresh:** Daily. Each run reads notices published since the last run, with a three-day overlap. The Federal Register itself publishes on business days.
- **Key needed:** None.
- **What we store:** Title, publication date, the deadline from the notice's DATES section (with its stated time zone), amounts named in the notice, the eligible applicants paragraph, the summary, and links to the notice and its PDF. When a notice points to Grants.gov, we look up the Grants.gov listing so both records merge.
- **What we do not store:** Contact details. Email addresses in the published text are obscured, so we leave contacts out.
- **Known limits:** Volume is small, about 90 to 100 funding notices a year, because many agencies now post their calls only on Grants.gov. Some notices cover loans, loan guarantees, or tax credit allocations; we label those "Loans, guarantees, and credit". A notice with several deadlines in a table may show the earliest one rather than the main application date.
- **On a test load on October 22, 2026:** 100 notices from the past 12 months. 72 of them merged with a Grants.gov record. 3 were open as the primary record.

## Contracts and bids: federal

### SAM.gov Contract Opportunities

- **Covers:** Every federal contract notice still open for responses on SAM.gov: solicitations, combined synopses, presolicitations, sources sought, and special notices, one record per solicitation.
- **How we read it:** The public daily Contract Opportunities extract from SAM.gov Data Services (an official bulk file, no key). With a free SAM.gov API key, the hourly run also reads new notices through the Opportunities API version 2.
- **Documentation:** https://open.gsa.gov/api/get-opportunities-public-api/
- **Terms:** https://sam.gov/content/about/terms-of-use. Most material on SAM.gov is free of copyright, and data from the public APIs may be shared. The terms forbid scraping the website, so we use only the public extract and the public API.
- **Attribution we show:** Source: SAM.gov
- **Refresh:** A full read once a day from the extract, which SAM.gov rebuilds nightly. Hourly checks in between: with an API key they read new notices; without one they check whether the extract changed.
- **Key needed:** Optional free SAM.gov API key. It adds hourly updates between the daily extracts. A key tied to a SAM.gov role allows 1,000 requests a day; a key without a role allows 10, which is only enough for a daily check.
- **What we store:** One record per solicitation number. The newest notice is the record, and earlier amendments are listed on it with their dates and links. We keep title, notice type, agency and office, dates and deadline (with the published time zone), NAICS and product codes, set-aside, place of performance, the description (trimmed), contacts as published, and attachment links.
- **What we do not store:** Award notices. They name the winning contractor, so we count them and skip them. Justification notices and surplus sales are skipped too.
- **Known limits:** About 70 percent of notices give no place of performance, so a state filter misses them. The extract cuts very long descriptions. Without an API key, a new notice can take up to a day to appear.
- **On a test load on October 22, 2026:** 8,816 solicitations, 7,805 open and 839 forecasted (presolicitations).

## Contracts and bids: state and local

Almost no large state procurement system publishes open bids as open data or an official feed. The state and local sources below are each a dataset on a city, county, or state open data portal, read through the portal's API (the Socrata SODA API). They share these traits:

- **Key needed:** None. An optional free open data app token raises the shared rate limit.
- **robots.txt:** These portals allow the API path and ask for a one-second gap between requests, which we keep.
- **Refresh:** A full read in each scheduled run, so bids that leave the list are closed.
- **What we never store:** Award notices or any column that names a contracted firm.

To add a portal, see [Adding a state or local procurement source](adding-a-procurement-source.md).

### NYC City Record Online

- **Covers:** Open solicitations from every New York City agency as published in the City Record, including construction and design work from DDC, DEP, Parks, NYCHA, and Health + Hospitals.
- **How we read it:** NYC Open Data dataset `dg92-zbpx` (open data portal API). We read the Procurement section, solicitation notices only.
- **Documentation:** https://data.cityofnewyork.us/City-Government/City-Record-Online/dg92-zbpx
- **Terms:** https://www.nyc.gov/main/terms-of-use. The dataset is marked public domain, and the city's open data law makes datasets available without restrictions on their use.
- **Attribution we show:** Source: The City Record, NYC Department of Citywide Administrative Services, via NYC Open Data
- **Refresh:** Daily.
- **What we store:** One record per solicitation number and agency. Extensions and re-advertisements are listed on it as amendments. Title, agency, due date (New York time), category, set-aside goals named in the notice, contact, document links, and the City Record page.
- **What we do not store:** Award and intent-to-award notices, which name vendors.
- **Known limits:** Some notices use placeholder due dates for open-ended calls; we treat those as open only if posted in the last 18 months. Some solicitation numbers are placeholders, so those notices do not merge with other sources.
- **On a test load on October 22, 2026:** 238 records, 113 open.

### Los Angeles RAMP open bids

- **Covers:** Open bids, proposals, and qualification requests from City of Los Angeles departments (Public Works, LADWP, Airports, Harbor) and other agencies posting on RAMP.
- **How we read it:** data.lacity.org dataset `hf3r-utnq` (open data portal API).
- **Documentation:** https://data.lacity.org/d/hf3r-utnq
- **Terms:** https://data.lacity.org/terms-of-use. The dataset is released under CC0 1.0, a public domain dedication.
- **Attribution we show:** Source: City of Los Angeles, RAMP, via data.lacity.org
- **Refresh:** Daily. The dataset itself refreshes hourly.
- **What we store:** Title, agency, close date, category, and the RAMP page for the bid.
- **Known limits:** Other agencies in the region (such as the school district and the county) post on RAMP too, so not every bid is a City of Los Angeles bid. We label each with the agency that posted it.
- **On a test load on October 22, 2026:** 218 records, 217 open.

### San Francisco open bids

- **Covers:** Open bid events from San Francisco departments on SF City Partner, including Public Works, Recreation and Park, and Public Utilities construction packages.
- **How we read it:** DataSF dataset `eshn-8t3a` (open data portal API).
- **Documentation:** https://data.sf.gov/d/eshn-8t3a
- **Terms:** https://www.sf.gov/reports--april-2017--datasf-terms-use. "Data is made available under the Public Domain Dedication and License v1.0."
- **Attribution we show:** Source: City and County of San Francisco, Controller's Office, via DataSF
- **Refresh:** Weekly at the source; we check daily.
- **What we store:** Title, department, due date (Pacific time), local business enterprise markings, and the SF City Partner link.
- **Known limits:** Some events carry a placeholder due date in 2099; those are standing open events.
- **On a test load on October 22, 2026:** 77 records, 65 open.

### TxDOT highway lettings

- **Covers:** Texas Department of Transportation construction and maintenance contracts: those advertised for the next letting, and those scheduled to let in the coming twelve months.
- **How we read it:** Texas Open Data Portal dataset `drau-zphx`, "Project Information" (open data portal API).
- **Documentation:** https://data.texas.gov/d/drau-zphx
- **Terms:** https://data.texas.gov/. The state publishes the dataset on its open data portal for public use, and nothing in the portal terms restricts API access. No separate license is stated.
- **Attribution we show:** Source: Texas Department of Transportation, TxDOTCONNECT, via the Texas Open Data Portal
- **Refresh:** Daily. The dataset refreshes several times a day.
- **What we store:** One record per controlling project, which is how TxDOT lets contracts. Letting type, county and district, work description, bid date (Central time), and the estimate while bids are still ahead.
- **What we do not store:** The amount after the letting (the column then holds the low bid). The plan holder and bid tabulation datasets are not read.
- **Known limits:** TxDOT has no public web page per project, so the link opens the record in the open data portal. Projects not yet advertised are shown as forecasted. No NAICS codes, since TxDOT publishes no crosswalk from its work types.
- **On a test load on October 22, 2026:** 1,394 records, 128 open and 1,099 forecasted.

### Delaware open bids

- **Covers:** Open bids posted by Delaware state agencies, school districts, and colleges on the Delaware Bids marketplace.
- **How we read it:** data.delaware.gov dataset `2hnj-zwix` (open data portal API).
- **Documentation:** https://data.delaware.gov/d/2hnj-zwix
- **Terms:** http://opendatacouncil.delaware.gov/open-data-portal-terms-of-service/. Data is provided as is, with no restriction on reuse or automated access. No license is stated.
- **Attribution we show:** Source: Delaware Office of Management and Budget, Government Support Services, via data.delaware.gov
- **Refresh:** Weekly at the source; we check daily.
- **What we store:** Title, agency code, due day, commodity codes, and the bid page on mmp.delaware.gov.
- **Known limits:** The dataset gives the due day only, so we set the close to the end of that day, Eastern time. Agencies appear by code, not name.
- **On a test load on October 22, 2026:** 53 records, 47 open.

### Montgomery County, MD solicitations

- **Covers:** Active invitations for bids, requests for proposals, and informal solicitations from the Montgomery County, Maryland Office of Procurement, with construction and local small business reserve flags.
- **How we read it:** dataMontgomery dataset `eeq6-nnwe` (open data portal API).
- **Documentation:** https://data.montgomerycountymd.gov/d/eeq6-nnwe
- **Terms:** https://opendatapolicyhub.sunlightfoundation.com/collection/montgomery-county-md-2012-12-17/. Under the county's Open Data Act, data sets "must be made available without any registration or license requirement or restriction on use."
- **Attribution we show:** Source: Montgomery County, Maryland, Office of Procurement, via dataMontgomery
- **Refresh:** Daily.
- **What we store:** Title, solicitation number, closing day, construction flag, the Local Small Business Reserve Program flag, buyer name, and the county's solicitation tracker page.
- **Known limits:** Closing dates carry no time, so we set the close to the end of that day, Eastern time. Bids are submitted through a separate marketplace; we link only to the county's page.
- **On a test load on October 22, 2026:** 37 records, 20 open.

### Illinois CDB upcoming construction bids

- **Covers:** State construction projects the Illinois Capital Development Board expects to put out to bid soon, with estimated bid dates and cost ranges.
- **How we read it:** data.illinois.gov dataset `6rb8-ntpm` (open data portal API).
- **Documentation:** https://data.illinois.gov/d/6rb8-ntpm
- **Terms:** https://data.illinois.gov/. Illinois publishes state data on this portal for public use under its Open Operating Standard Act. No license is stated, and nothing restricts API access.
- **Attribution we show:** Source: Illinois Capital Development Board, via data.illinois.gov
- **Refresh:** Weekly.
- **What we store:** Project name, location, estimated bid date, and the stated cost range.
- **What we do not store:** The architect or engineer of record, since that column names a contracted firm.
- **Known limits:** This is a forecast list, so every record is forecasted until it leaves the list. There is no public page per project; the link opens the record in the open data portal.
- **On a test load on October 22, 2026:** 47 records, all forecasted.

## Contracts and bids: international

### EU Funding & Tenders Portal

- **Covers:** Open and forthcoming European Union calls for proposals (Horizon Europe, Erasmus+, LIFE, CERV, Digital Europe, and more), EU external action grants, cascade funding calls, and calls for tenders from EU institutions. Calls for proposals appear as grants or research funding; calls for tenders appear as bids.
- **How we read it:** The portal's public search API, which the portal documents for use by external systems. It uses a public access code printed in the documentation, not a private key.
- **Documentation:** https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/support/apis
- **Terms:** https://commission.europa.eu/legal-notice_en. Commission content is licensed CC BY 4.0 under Decision 2011/833/EU, reusable "provided appropriate credit is given and changes are indicated."
- **Attribution we show:** Source: EU Funding & Tenders Portal, European Commission
- **Refresh:** Daily, as a full read.
- **Key needed:** None.
- **What we store:** Topic or reference number, title, programme, deadlines (topic deadlines at 17:00 Brussels time, as the portal sets them), budget lines, contracting authority, estimated value and currency for tenders, published call documents as links, and the portal page.
- **Known limits:** The portal's own status field often lags, so we work out status from the deadlines and skip records whose deadlines have all passed. Tenders give no place of performance, so they show "European Union". We read the English-language records.
- **On a test load on October 22, 2026:** 800 records, 444 open and 319 forecasted.

### Contracts Finder (UK)

- **Covers:** Open UK public sector tenders published on Contracts Finder, mostly English contracts from about 12,000 pounds up to the Find a Tender threshold.
- **How we read it:** The Contracts Finder OCDS search API (Open Contracting Data Standard).
- **Documentation:** https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search
- **Terms:** https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/. Each data package is licensed under the Open Government Licence v3.0, which allows commercial and non-commercial reuse with attribution.
- **Attribution we show:** Contains public sector information licensed under the Open Government Licence v3.0.
- **Refresh:** Daily. When the service asks us to slow down, we pause five minutes as its documentation says.
- **Key needed:** None.
- **What we store:** One record per procurement process (the newest release wins): buyer, buyer's reference, title, deadline (London time), value range in pounds, delivery region, suitability for small businesses and voluntary sector organizations, the buyer contact point, and the notice page.
- **What we do not store:** Award and contract releases, which name suppliers.
- **Known limits:** Since the Procurement Act 2023 took effect in February 2025, most UK tenders go to Find a Tender instead, so this service now carries few open notices.
- **On a test load on October 22, 2026:** 169 records, 165 open.

### Find a Tender (UK)

- **Covers:** Open UK public sector tenders above the procurement thresholds, from every part of the UK, published on Find a Tender.
- **How we read it:** The Find a Tender OCDS release packages API.
- **Documentation:** https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
- **Terms:** https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/. Open Government Licence v3.0, as above.
- **Attribution we show:** Contains public sector information licensed under the Open Government Licence v3.0.
- **Refresh:** Daily, as a full read of the last 60 days of releases.
- **Key needed:** None.
- **What we store:** The same fields as Contracts Finder, with the Find a Tender notice page. An award or cancellation release closes the process.
- **What we do not store:** Award and contract releases, which name suppliers.
- **Known limits:** The API's stage filter leaves out notices under the new Procurement Act, so we read every release and decide per release. A long-running notice that has not been updated in the last 60 days can be missed.
- **On a test load on October 22, 2026:** 1,488 records, 1,406 open.

### World Bank procurement notices

- **Covers:** Open invitations for bids and requests for expressions of interest on World Bank financed projects worldwide.
- **How we read it:** The World Bank procurement notices API, named in the World Bank Data Catalog as the official source for these datasets.
- **Documentation:** https://financesone.worldbank.org/api-explorer?id=DS01594
- **Terms:** https://www.worldbank.org/ext/en/legal/terms-conditions/datasets. Unless labeled otherwise, the datasets are "provided to you under a Creative Commons Attribution 4.0" license, and the procurement notice datasets are labeled CC BY 4.0.
- **Attribution we show:** Source: World Bank procurement notices
- **Refresh:** Daily, as a full read.
- **Key needed:** None.
- **What we store:** Notice type, title as published (English, French, Spanish, or Portuguese), country, project, the borrower's implementing agency, deadline, and the notice page.
- **What we do not store:** Contract award notices, which name winners.
- **Known limits:** The API gives the deadline hour in local time with no time zone. We store the hour and add "local time in" the country to the deadline text, so check the notice for the exact time.
- **On a test load on October 22, 2026:** 669 records, 664 open.

## Research funding

Research funding also comes from Grants.gov (most NIH, NSF, NASA, Department of Defense, and Department of Energy calls) and the EU portal (Horizon Europe). The sources below add detail the general listings do not carry.

### NIH Guide for Grants and Contracts

- **Covers:** Active NIH funding notices (RFAs, program announcements, and PARs) with due dates, activity codes, and participating institutes.
- **How we read it:** The NIH Guide search service, which returns the same data the Guide's search page shows, in JSON.
- **Documentation:** https://grants.nih.gov/funding/nih-guide-for-grants-and-contracts
- **Terms:** https://www.nih.gov/web-policies-notices. NIH notices are U.S. government works and are in the public domain unless marked otherwise.
- **Attribution we show:** Source: NIH Guide for Grants and Contracts
- **Refresh:** Daily, as a full read. Due dates roll forward without the notice changing, so each run reads the whole active list.
- **Key needed:** None.
- **What we store:** Notice number, title, notice type, activity codes, the primary and participating institutes, key dates from the notice's Key Dates table (earliest submission, letter of intent, standard and AIDS due dates, expiration), eligible organizations, whether foreign organizations may apply, clinical trial and direct cost cap notes, and the link to the notice.
- **Known limits:** From fiscal year 2026, NIH posts new funding notices only on Grants.gov. The Guide index still lists them, and for those we link to the Grants.gov page. NIH notices also appear on Grants.gov, so Grants.gov is the primary record and the NIH Guide is listed on it.
- **On a test load on October 22, 2026:** 389 notices, every one merged with its Grants.gov record.

### NSF funding opportunities

- **Covers:** Every NSF program, solicitation, program description, and Dear Colleague Letter inviting proposals, with due dates, target dates, and accepted-anytime programs.
- **How we read it:** NSF's public sitemap and each funding opportunity page it lists, at one request per second. robots.txt allows both. NSF's search export is disallowed by robots.txt, so we do not use it.
- **Documentation:** https://www.nsf.gov/sitemap.xml
- **Terms:** https://www.nsf.gov/policies/reuse.jsp. Most NSF text is public domain, and users "may freely copy" it, with a requested credit line.
- **Attribution we show:** Courtesy: U.S. National Science Foundation
- **Refresh:** Daily, as a full read.
- **Key needed:** None.
- **What we store:** Title, solicitation or program description number, synopsis, upcoming due dates (deadline or target date, and their recurrence), accepted-anytime status, the directorates and divisions, estimated awards, and the page link. Fellowships are listed as scholarships for individuals.
- **What we do not store:** Dear Colleague Letters that announce a policy or event without asking for proposals.
- **Known limits:** Opportunity pages rarely state who may apply (the solicitation does), so eligibility is often empty. Programs under an umbrella solicitation take that solicitation's dates. NSF solicitation numbers are written differently on Grants.gov, so some NSF solicitations appear on both without merging.
- **On a test load on October 22, 2026:** 370 records, 260 open and 36 forecasted.

### SBIR.gov solicitations

- **Covers:** Open SBIR and STTR solicitations from all eleven participating agencies, with topic counts and open and close dates, for U.S. small businesses.
- **How we read it:** The public topic search pages and topic pages on SBIR.gov, which robots.txt allows. The SBIR.gov public API answers "Forbidden" to every request and is marked as under maintenance, so we do not use it.
- **Documentation:** https://www.sbir.gov/data-resources
- **Terms:** https://www.sba.gov/about-sba/open-government/about-sbagov-website/policies-notices. Government information on SBA sites is public domain and may be copied; SBA asks for acknowledgement.
- **Attribution we show:** Source: SBIR.gov, U.S. Small Business Administration
- **Refresh:** Daily, as a full read.
- **Key needed:** None.
- **What we store:** One record per agency solicitation: agency, branch, solicitation number, program and phase, release, open, and close dates, topic count and topic titles, links to each topic page, and the official solicitation link.
- **Known limits:** SBIR.gov notes that its topics are copies; the official version is at the agency, which we link. The search has no stable order, so each run reads the list in several passes until nothing new appears.
- **On a test load on October 22, 2026:** 10 solicitations covering 306 topics. 1 open and 3 forecasted as the primary record; the others merged with Grants.gov, NSF, or SAM.gov records.

## Foundations and nonprofits

### IRS Form 990-PF (private foundations)

- **Covers:** Private grantmaking foundations in every state from IRS filings, with how to apply, deadlines, typical grant sizes, and past grantees for the larger ones.
- **How we read it:** Official IRS bulk files: the Exempt Organizations Business Master File, the yearly Statistics of Income 990-PF extract, and the public 990-PF e-file returns (XML) with their index. We also link to the filing itself on apps.irs.gov when we can find it: the IRS Tax Exempt Organization Search lists each return with a public PDF copy, and we use that link when it matches the tax period we read.
- **Documentation:** https://www.irs.gov/charities-non-profits/form-990-series-downloads
- **Terms:** https://www.irs.gov/about-irs/use-of-content-from-irsgov. IRS content "is not subject to copyright and may be freely copied." Credit is requested.
- **Attribution we show:** Source: Internal Revenue Service
- **Refresh:** Daily. Every foundation that paid grants is refreshed when the IRS files change. Detail from the full return is read for up to 2,000 foundations a run, those that gave at least $100,000 a year, largest first. A foundation whose newest return we already read is skipped.
- **Key needed:** None.
- **What we store:** For every foundation that paid grants: name, city, state, total giving, assets, and tax year. For foundations read in detail: application instructions, contact, and deadlines as filed, restrictions, whether it gives only to preselected organizations, grant count and typical sizes, focus areas, the states and cities it gives to most, up to 15 organization grantees with a short purpose, and its website. A foundation that accepts applications and made at least three grants to organizations becomes an open opportunity. One that publishes how to apply and mostly gives scholarships also gets a scholarship opportunity.
- **What we do not store:** Names of individuals who received grants or scholarships. We keep only their count, total, and typical size.
- **Known limits:** Filings describe the past. A deadline is as written on the most recent return and may have changed since. The newest filings are often not yet available as PDFs, so some foundations link to an IRS search page instead. Detail for smaller foundations is not read.
- **On a test load on October 22, 2026:** 81,649 private foundations; 876 open foundation opportunities (843 grants and 33 scholarships).

### IRS exempt organization registry (EO BMF and Publication 78)

- **Covers:** Every organization the IRS recognizes as tax exempt, with its 501(c) subsection and whether gifts to it are deductible, for checking an applicant's status by EIN.
- **How we read it:** Official IRS bulk files: the Exempt Organizations Business Master File extract and the Publication 78 data download.
- **Documentation:** https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads
- **Terms:** https://www.irs.gov/about-irs/use-of-content-from-irsgov. Same IRS terms as above.
- **Attribution we show:** Source: Internal Revenue Service
- **Refresh:** Monthly. The IRS updates both files monthly.
- **Key needed:** None.
- **What we store:** EIN, name, city, state, 501(c) subsection, foundation code, deductibility, ruling year, NTEE code, and Publication 78 codes. Setup uses this to tell an organization plainly whether the IRS lists it as a 501(c)(3), whether gifts to it are deductible, and whether it is a private foundation.
- **Known limits:** These files are not opportunities and do not appear in search. An organization recognized very recently may not be in the files yet.
- **Size:** About 1.98 million organizations.

## Scholarships and fellowships

Scholarships and fellowships also come from Grants.gov (federal fellowships), NSF (fellowship programs), and private foundations that publish how to apply for scholarships.

### Scholarships and fellowships, checked by hand

- **Covers:** Well-known national scholarships and fellowships for U.S. students and individuals, each checked on the sponsor's official page.
- **How we read it:** We read each sponsor's official program page and record the facts. Once a month a check visits every page and flags dead links, changed deadline wording, and passed deadlines, and we update the entry by hand.
- **Documentation:** Each record links to the sponsor's page.
- **Terms:** We record short facts (name, sponsor, amount as stated, deadline, eligibility in one sentence) and link to the page. We do not copy page text beyond short phrases.
- **Attribution we show:** Source: each sponsor's official program page
- **Refresh:** Checked by hand each month and loaded weekly.
- **Key needed:** None.
- **What we store:** Program name, sponsor, award amount as stated, deadline, level of study, a one-sentence eligibility summary, the next cycle note when the current one has closed, and the link.
- **Known limits:** A short list, not a full directory. A deadline the page gives as a yearly rule (for example, "the last Friday in January") is marked as such. When a page has no posted deadline, the record is forecasted with "The next deadline is not posted yet".
- **On a test load on October 22, 2026:** 79 programs from 66 sponsors, 34 open and 25 forecasted.

## Past awards

These sources describe money already awarded. We store totals and typical sizes only, never a list of awards. They power the "who buys this work" and "typical award" figures; they do not create opportunities.

### USAspending.gov

- **Covers:** Past federal contract and grant awards as yearly totals: how many awards, how much, and typical award sizes by NAICS code, Assistance Listing, agency, and state.
- **How we read it:** The USAspending.gov API's award download, filtered to new awards in each fiscal year, with only the columns we need.
- **Documentation:** https://api.usaspending.gov/docs/endpoints
- **Terms:** https://www.usaspending.gov/about. The data is "available to copy, adapt, redistribute, or otherwise use for non-commercial or for commercial purposes." A limitation on recipient identity data does not affect us, since we never request recipient fields.
- **Attribution we show:** Source: USAspending.gov, U.S. Department of the Treasury
- **Refresh:** Weekly. Each run covers the current fiscal year, and also the previous one from October to December while late reports arrive.
- **Key needed:** None.
- **What we store:** For each fiscal year: award count, total, median, quartiles, smallest, and largest. Construction and architecture and engineering contracts are grouped by NAICS code, agency, sub-agency, and state, with a breakdown by set-aside. Other contracts are grouped the same way for awards of $250,000 or more. Grants and cooperative agreements are grouped by Assistance Listing, agency, sub-agency, and state.
- **What we do not store:** Recipient names, identifiers, addresses, or award ids. Nothing per award is kept after the totals are computed.
- **Known limits:** For contracts outside construction and architecture and engineering, the figures cover only awards of $250,000 or more. About 60 percent of contract awards (mostly orders under a larger contract) carry no set-aside code on the award itself, so the set-aside breakdown covers only awards that report one. Defense contract data is published with a 90-day delay. Loans, direct payments, and insurance are not included.

### NIH RePORTER

- **Covers:** Past NIH awards, summarized by institute, activity code, state, and fiscal year (counts, totals, and typical award sizes).
- **How we read it:** The NIH RePORTER API version 2, at no more than one request per second and on a weekend schedule, as its documentation asks.
- **Documentation:** https://api.reporter.nih.gov/
- **Terms:** https://www.nih.gov/web-policies-notices. NIH award data is a U.S. government work in the public domain.
- **Attribution we show:** Source: NIH RePORTER
- **Refresh:** Weekly. Each run updates the last completed fiscal year.
- **Key needed:** None.
- **What we store:** Award count, total, median, quartiles, smallest, and largest, by institute, activity code, and state.
- **What we do not store:** Project records, organization names, or investigator names.
- **Known limits:** Supplements and placeholder amounts under $1,000 are left out. A state figure is shown only when it covers at least three awards; national figures count everything.

### NSF Award Search

- **Covers:** Past NSF awards, summarized by directorate, program, state, and fiscal year (counts, totals, and typical award sizes).
- **How we read it:** The NSF Award Search API, at one request per second, outside NSF's weekend maintenance window.
- **Documentation:** https://resources.research.gov/common/webapi/awardapisearch-v1.htm
- **Terms:** https://www.nsf.gov/policies/reuse.jsp. Same NSF reuse policy as above.
- **Attribution we show:** Courtesy: U.S. National Science Foundation
- **Refresh:** Weekly.
- **Key needed:** None.
- **What we store:** Award count, total, median, quartiles, smallest, and largest, by directorate, funding program, and state.
- **What we do not store:** Award records, institution names, or investigator names.
- **Known limits:** An award funded by several programs counts at the directorate and state levels but not under any single program. A state figure is shown only when it covers at least three awards.

### SBIR.gov awards

- **Covers:** Past SBIR and STTR awards, summarized by agency, branch, phase, program, state, and fiscal year (counts, totals, and typical award sizes).
- **How we read it:** The full award file SBIR.gov publishes on its data resources page (an official bulk file, rebuilt daily).
- **Documentation:** https://www.sbir.gov/data-resources
- **Terms:** https://www.sba.gov/about-sba/open-government/about-sbagov-website/policies-notices. Same SBA terms as above.
- **Attribution we show:** Source: SBIR.gov, U.S. Small Business Administration
- **Refresh:** Weekly.
- **Key needed:** None.
- **What we store:** Award count, total, median, quartiles, smallest, and largest for the last five completed fiscal years.
- **What we do not store:** Company names, identifiers, addresses, contacts, or investigator names. We never read those columns into our data.
- **Known limits:** Agencies report awards late, so the most recent fiscal year looks thin for months. A state figure is shown only when it covers at least three awards.

On a test load on October 22, 2026, the four past award sources held 125,551 summary rows in all.

## Sources considered and not used

We checked each of these and left it out. Most could be added if the publisher offers an official feed or dataset, or confirms automated use.

### Federal and research

| Source | Why not |
| --- | --- |
| NASA NSPIRES | No RSS feed, export, or documented API. Its solicitation list loads through a script call that is not offered for reuse. NASA calls reach the database through Grants.gov. |
| SAM.gov website pages | The SAM.gov terms forbid scraping the website. We use the public extract and API instead. |
| FederalRegister.gov website pages | The site limits automated access to its developer API. We use only the API. |
| NSF funding search export | Disallowed by NSF's robots.txt. We read the sitemap and opportunity pages, which are allowed. |
| SBIR.gov public API | Answers "Forbidden" to every request and is marked as under maintenance. We read the public topic pages instead. |
| NIH Guide RSS feed | Lists about 30 recent items, mostly notices that are not funding calls. Not a full list. |

### State and local procurement portals

| Portal | Why not |
| --- | --- |
| New York State Contract Reporter | No official feed or open dataset; the site requires registration. |
| New York SUCF advertised procurements (data.ny.gov) | The state open data terms prohibit access by automated device, script, or bot. Held until New York confirms API use is allowed. |
| California Cal eProcure | No open dataset or feed of open events, and robots.txt refuses our requests. data.ca.gov has purchase orders only. |
| Texas ESBD (txsmartbuy.gov) | robots.txt disallows all automated access, and there is no feed. TxDOT lettings cover Texas highway construction instead. |
| Florida Vendor Bid System and MyFloridaMarketPlace | The bid system has been archive-only since 2022; the marketplace has no documented feed or dataset. |
| Washington WEBS | No feed or dataset of open bids. |
| Illinois BidBuy | No feed. The Capital Development Board forecast is the only open dataset. |
| Pennsylvania eMarketplace | robots.txt disallows all automated access, and there is no feed. |
| Massachusetts COMMBUYS | No feed or dataset. |
| Virginia eVA | The open data portal publishes purchase orders, not open solicitations. |
| Maryland eMMA | robots.txt disallows all automated access. The state's bid datasets stopped in fiscal year 2019. |
| Colorado (ColoradoVSS, CDOT) | No dataset or feed. CDOT advertisement lists are web pages and PDFs. |
| North Carolina eVP | A public search page only, with no export or feed. |
| Ohio OhioBuys | No feed or dataset. |
| Chicago, Seattle, Austin, Dallas, Boston, Philadelphia | No open bid dataset or official feed. Their portals hold contracts, spending, or compliance data. |
| City of San Diego | No bids dataset; bids go through a vendor registration portal. |
| San Diego County procurement forecast | Forecast only, no record pages, and the portal's terms could not be found. |
| NYC School Construction Authority RFP lists | Updated by hand and out of date, or forecasts without record pages. The City Record already carries these solicitations. |
| Cook County buying plans and intent to award | Plans and award notices that name vendors, not open bids. |
| Cambridge, MA contracts bid list | Awarded contracts with vendor names. |
| Mesa, AZ purchasing solicitations | A performance dataset without due dates or links. |
| Scottsdale, AZ purchasing solicitations | Out of date: the last close date is December 2023. |
| City and county "bid postings" RSS feeds on shared website hosting | Several sit behind a bot challenge, and the feeds we checked returned site pages, not bids. |
| USAC E-Rate Form 470 | A federal program outside the state and local scope. It could be added as its own source. |

### International

| Source | Why not |
| --- | --- |
| GOV.UK Find a grant | Its content is under the Open Government Licence, but the service offers no API, feed, or open data export of its listings, and we do not read web pages for it. We will add it if GOV.UK publishes a feed. |

### Scholarships

| Program | Why not |
| --- | --- |
| Mitchell Scholarship, Microsoft Research PhD Fellowship, Soros Justice Fellowships | The sponsor has paused the program. |
| Ford Foundation Fellowships | The old page now redirects to a page with no Ford program. |
| National Merit Scholarship | The sponsor's site refuses our requests. |
| NOAA Nancy Foster Scholarship, National Physical Science Consortium, Payne Fellowship | The sponsor's site could not be reached. |
| SMART Scholarship, Equitable Excellence, Apple Scholars in AIML, Generation Google | The pages show their content only with JavaScript or refuse requests, so no facts could be read. |
| Rotary Peace Fellowships | The site answered our request with "too many requests". |
| Echoing Green | Its funding goes to organizations, not individuals. |
| AAUW International | The page lists only past dates. |
| UNCF general listing, TMCF, NSBE, SHPE, DAR, Scholastic Art & Writing | Hubs of many small awards with no single deadline. UNCF appears through one named scholarship. |
| QuestBridge College Prep Scholars, Astronaut Scholarship | No deadline or amount on the page, or nomination only. |
| NIH F31, Fulbright-Hays, NSF GRFP, CyberCorps | Already covered by Grants.gov and NSF. |

## How to suggest a source

If you know an official source we should add, tell us through the contact page at https://fundfellows.com/contact. Include a link to the source, its documentation or terms page, and what it covers.

For a state or local procurement portal, [Adding a state or local procurement source](adding-a-procurement-source.md) lists the checks a portal must pass (it lists open solicitations, it publishes them in a documented reusable format, its terms allow reuse and automated access, robots.txt allows the API path, and each record links to a public page) and how a new portal is configured and tested.
