import type { CatalogStatus, CatalogType, CauseCode, EligibilityCode, ResearchAreaCode } from "./vocab";

export type { CatalogStatus, CatalogType, CauseCode, EligibilityCode, ResearchAreaCode } from "./vocab";

export type FunderKind =
  | "federal_agency"
  | "state_agency"
  | "local_government"
  | "private_foundation"
  | "community_foundation"
  | "corporate"
  | "university"
  | "international"
  | "other";

/** One data source, as recorded in catalog_sources and shown on /data. */
export interface SourceDefinition {
  id: string;
  name: string;
  /** What it covers, one plain sentence for the /data page. */
  covers: string;
  homepage: string;
  docsUrl?: string;
  termsUrl?: string;
  license: string;
  attribution?: string;
  kinds: CatalogType[];
  region: "us" | "state" | "local" | "international";
  /** How often we refresh it, in plain words. */
  cadence: string;
  /** GitHub Actions cron for the incremental job (UTC). */
  schedule?: string;
  /** Env var that must hold a free key, when the source needs one. */
  needsKey?: string;
  /** Env var for a free key the source works without but uses when present (faster or fresher updates). */
  optionalKey?: string;
  /** Off until its terms are confirmed or it is turned on in config. */
  enabled: boolean;
  /** Lower wins when the same opportunity is listed by two sources. */
  priority: number;
  notes?: string;
}

export interface KeyDate {
  kind: string;
  date: string;
  label?: string;
}

export interface Attachment {
  name: string;
  url: string;
  size?: number | null;
}

export interface Amendment {
  number?: string | null;
  date?: string | null;
  summary?: string | null;
  url?: string | null;
}

/** A normalized opportunity, as a connector emits it. The store fills ids, hashes, and timestamps. */
export interface OpportunityInput {
  sourceId: string;
  sourceUrl: string;
  opportunityNumber?: string | null;
  /** Overrides the default dedupe key (see canonicalKey in ./normalize). */
  canonicalKey?: string | null;
  type: CatalogType;
  noticeType?: string | null;
  title: string;
  summary?: string | null;
  funderKey?: string | null;
  funderName?: string | null;
  agencyCode?: string | null;
  status: CatalogStatus;
  postedAt?: string | null;
  openAt?: string | null;
  closeAt?: string | null;
  closeText?: string | null;
  archiveAt?: string | null;
  rolling?: boolean;
  keyDates?: KeyDate[];
  amountMin?: number | null;
  amountMax?: number | null;
  amountTotal?: number | null;
  awardCount?: number | null;
  currency?: string;
  eligibility?: EligibilityCode[];
  eligibilityText?: string | null;
  naics?: string[];
  psc?: string | null;
  setAside?: string | null;
  setAsideCode?: string | null;
  assistanceListings?: string[];
  researchAreas?: ResearchAreaCode[];
  causes?: CauseCode[];
  categories?: string[];
  place?: { state?: string | null; city?: string | null; country?: string | null; zip?: string | null; text?: string | null };
  attachments?: Attachment[];
  amendments?: Amendment[];
  contact?: { name?: string | null; email?: string | null; phone?: string | null; title?: string | null } | null;
  extra?: Record<string, unknown>;
  license?: string | null;
}

export interface FunderGivingYear {
  year: number;
  totalGiving?: number | null;
  grantCount?: number | null;
  grantMedian?: number | null;
  grantMin?: number | null;
  grantMax?: number | null;
  assets?: number | null;
  sourceUrl?: string | null;
}

export interface FunderInput {
  key: string;
  name: string;
  kind: FunderKind;
  parentKey?: string | null;
  ein?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  focus?: string[];
  geography?: string[];
  acceptsApplications?: boolean | null;
  grantsToIndividuals?: boolean | null;
  typicalGrantMin?: number | null;
  typicalGrantMedian?: number | null;
  typicalGrantMax?: number | null;
  totalGiving?: number | null;
  assets?: number | null;
  taxYear?: number | null;
  sourceUrl: string;
  extra?: Record<string, unknown>;
  giving?: FunderGivingYear[];
}

/** Past awards, aggregated. Never a contract winner's name. */
export interface AwardStatInput {
  awardType: CatalogType;
  agency: string;
  subAgency?: string | null;
  naics?: string | null;
  psc?: string | null;
  assistanceListing?: string | null;
  activityCode?: string | null;
  program?: string | null;
  placeState?: string | null;
  setAside?: string | null;
  fiscalYear: number;
  awardCount: number;
  totalAmount: number;
  medianAmount?: number | null;
  p25Amount?: number | null;
  p75Amount?: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  sourceUrl?: string | null;
}

export interface PoliteFetchInit extends RequestInit {
  /** Retries on 429, 5xx, and network errors. Default 4. */
  retries?: number;
  /** Per-request timeout in ms. Default 60s. */
  timeoutMs?: number;
}

export type PoliteFetch = (url: string, init?: PoliteFetchInit) => Promise<Response>;

export interface IngestStats {
  seen: number;
  added: number;
  updated: number;
  closed: number;
  funders: number;
  awards: number;
}

export interface IngestContext {
  mode: "backfill" | "incremental";
  /** Start of the last successful run of this source, for incremental pulls. */
  since: Date | null;
  /** Rate-limited, retrying, robots-respecting fetch with our User-Agent. */
  fetch: PoliteFetch;
  /** Downloads a large file once to the cache directory and returns its path. */
  download: (url: string, fileName: string, opts?: { maxAgeHours?: number; headers?: Record<string, string> }) => Promise<string>;
  cacheDir: string;
  env: Record<string, string | undefined>;
  /** Stop after this many opportunities (dev and tests). */
  limit: number | null;
  log: (message: string) => void;
  /** Record a recoverable error (bad row, one failed page); the run continues. */
  warn: (message: string, detail?: unknown) => void;
  funders: (rows: FunderInput[]) => Promise<void>;
  opportunities: (rows: OpportunityInput[]) => Promise<void>;
  awards: (rows: AwardStatInput[]) => Promise<void>;
  /** True once `limit` opportunities have been emitted; connectors should stop paging. */
  done: () => boolean;
  stats: IngestStats;
}

export interface Connector {
  source: SourceDefinition;
  /**
   * The source lists every live opportunity each run (a full snapshot). After a
   * successful backfill, open rows of this source that were not seen are closed.
   */
  fullSnapshot?: boolean;
  run(ctx: IngestContext): Promise<void>;
}
