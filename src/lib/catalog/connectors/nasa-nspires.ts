import type { Connector, SourceDefinition } from "../types";

/**
 * NASA NSPIRES (NASA Solicitation and Proposal Integrated Review and Evaluation System).
 *
 * Off. NSPIRES offers no feed: no RSS, no export, and no documented API. Its solicitation list is filled in the browser
 * by an undocumented script call, and the site is a U.S. government system with a monitoring notice rather than reuse
 * terms for automated access. Its robots.txt allows /external/solicitations/ but its sitemap lists only the search
 * page itself, not solicitations. We do not scrape it.
 *
 * Coverage does not depend on it: NASA posts its funding notices on Grants.gov too (ROSES program elements appear there
 * as NNH..ZDA001N-XXXX under agency NASA-HQ), and the Grants.gov connector already carries them.
 * Turn this on only if NASA publishes a sanctioned feed; the run below then needs an implementation.
 */
export const source: SourceDefinition = {
  id: "nasa_nspires",
  name: "NASA NSPIRES",
  covers: "NASA research solicitations (ROSES and others) as listed in NSPIRES. Off: no sanctioned feed; NASA notices reach the catalog through Grants.gov.",
  homepage: "https://nspires.nasaprs.com/external/",
  docsUrl: "https://nspires.nasaprs.com/external/solicitations/solicitations!init.do",
  termsUrl: "https://www.nasa.gov/nasa-web-privacy-policy-and-important-notices/",
  license: "Public domain (U.S. government work)",
  attribution: "Source: NASA NSPIRES",
  kinds: ["research"],
  region: "us",
  cadence: "Not scheduled",
  enabled: false,
  priority: 20,
  notes: "Off: NSPIRES has no RSS, export, or API; its list loads through an undocumented script call. NASA notices are covered by Grants.gov (agency NASA-HQ).",
};

export const nasaNspires: Connector = {
  source,
  async run(ctx) {
    ctx.log("NASA NSPIRES is off: no sanctioned feed. NASA notices come in through Grants.gov.");
  },
};

export const connectors: Connector[] = [nasaNspires];
