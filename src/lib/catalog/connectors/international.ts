import type { Connector } from "../types";
import { euFundingTenders } from "./_intl-eu";
import { ukContractsFinder, ukFindAGrant, ukFindATender } from "./_intl-uk";
import { worldBankProcurement } from "./_intl-worldbank";

/**
 * International sources: the EU Funding & Tenders Portal, UK Contracts Finder and Find a Tender, GOV.UK Find a grant
 * (off: no official feed), and World Bank procurement notices. Each source lives in its own helper module.
 */
export const connectors: Connector[] = [euFundingTenders, ukContractsFinder, ukFindATender, ukFindAGrant, worldBankProcurement];
