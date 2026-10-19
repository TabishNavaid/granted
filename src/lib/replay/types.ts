import type { CrawledPage } from "@/lib/crawl";
import type { OpportunityDetail, SearchResponse } from "@/lib/grantsgov";

/**
 * A recorded run for one sample organization. The demo replays it when no
 * model key is set, through the same agent code the live product runs: only
 * the three places data comes from (the website reader, Grants.gov, and the
 * model) are swapped for these recordings.
 *
 * Model responses refer to facts by label, because fact ids are made fresh
 * each time setup runs. The replay model reads the ids out of the prompt it
 * was given, the same list the live model sees, and fills them in:
 *   {{fact:Label}}         the fact with that label
 *   {{fact:Label=Value}}   when several facts share a label (programs)
 *   {{answer:gap_key}}     the fact the director just stated for that question
 *   {{value:gap_key}}      that answer's value, written as the director gave it
 * A label the visitor unchecked on the confirm screen resolves to nothing, and
 * the live validators then treat the claim as unverified, exactly as they
 * would for a live model that cited a fact it should not have.
 */
export type RecordingId = "youth" | "foodbank" | "clinic";

export interface RecordedCall {
  /** The `label` the agent code passes to the model, e.g. "extract_profile". */
  label: string;
  /** Only use this response when the prompt contains this text (an opportunity title, a gap key). */
  match?: string;
  /** How long the live call took when it was recorded, roughly. Replays wait this long. */
  durationMs: number;
  data: unknown;
}

export interface GrantsGovRecording {
  recordedAt: string;
  /** Keyed by `${keyword}|${fundingCategories joined by |}`. */
  searches: Record<string, SearchResponse>;
  details: Record<string, OpportunityDetail>;
}

export interface Recording {
  id: RecordingId;
  /** The day the Grants.gov half was fetched. Notices that have closed since then drop out on their own. */
  recordedOn: string;
  site: { homepage: string; pages: CrawledPage[]; skipped: { url: string; reason: string }[] };
  calls: RecordedCall[];
  grantsgov: GrantsGovRecording;
}
