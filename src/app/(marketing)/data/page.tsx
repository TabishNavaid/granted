import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/marketing/page-intro";
import { PRODUCT_NAME } from "@/lib/brand";
import { dataPageStats, groupSources, TYPE_LABELS } from "@/lib/catalog/stats";
import type { CatalogType } from "@/lib/catalog/vocab";

export const metadata: Metadata = {
  title: "Where the data comes from",
  description: `Every source ${PRODUCT_NAME} reads, what it covers, how often it is refreshed, and how many opportunities are open right now.`,
  alternates: { canonical: "/data" },
};

// Counts are read from the database at most every ten minutes.
export const revalidate = 600;

const nf = new Intl.NumberFormat("en-US");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null);
const TYPES: CatalogType[] = ["grant", "contract", "research", "scholarship"];

const principles = [
  "Every opportunity links to the official page it came from and shows the date we last checked it.",
  "The AI never adds a funder, a deadline, or an amount from memory. If it is not in a source, it is not shown.",
  "We use only sources whose terms allow reuse, keep to their published rate limits and robots rules, and never scrape a site that forbids it.",
  "Past contract awards are kept only as totals and typical sizes. We never show who won a contract.",
  "A notice is marked closed once its deadline passes, and anything a source withdraws is closed on the next refresh.",
];

export default async function DataPage() {
  const stats = await dataPageStats();
  const groups = groupSources(stats.sources);
  const asOf = day(stats.asOf);
  return (
    <>
      <PageIntro title="Where every opportunity comes from." lead={`${PRODUCT_NAME} reads official public sources on a schedule and keeps each record linked to the page it came from. Here is every source, what it covers, and how often we check it.`} />

      <section aria-labelledby="counts-title" className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <h2 id="counts-title" className="sr-only">
            Open right now
          </h2>
          <p className="font-display text-5xl leading-none tracking-[-0.03em] text-ink tnum sm:text-6xl">{nf.format(stats.totals.open + stats.totals.forecasted)}</p>
          <p className="mt-3 text-lg text-ink">opportunities open or announced{stats.live ? " right now" : ""}.</p>
          <dl className="mt-8 grid gap-x-8 gap-y-5 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-5">
            {TYPES.map((t) => (
              <div key={t}>
                <dt className="text-sm text-ink-muted">{TYPE_LABELS[t]}</dt>
                <dd className="mt-1 font-display text-3xl text-ink tnum">{nf.format(stats.totals.byType[t])}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-ink-muted">Private foundations on file</dt>
              <dd className="mt-1 font-display text-3xl text-ink tnum">{nf.format(stats.totals.foundations)}</dd>
            </div>
          </dl>
          <p className="mt-6 max-w-[70ch] text-sm text-ink-muted">
            {stats.live
              ? `Counted from the database on ${asOf}. The page refreshes every few minutes.`
              : asOf
                ? `Measured on ${asOf} from ${stats.label ?? "a test load of the database"}. This site is running without its database, so the counts are not live.`
                : "Counts appear here once the database is loaded."}{" "}
            Open means you can apply now; announced means the funder has published a forecast with expected dates.
          </p>
        </div>
      </section>

      <section aria-labelledby="sources-title">
        <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <h2 id="sources-title" className="font-display text-3xl text-ink lg:text-4xl">
            The sources
          </h2>
          {groups.map((g) => (
            <div key={g.title} className="mt-12">
              <h3 className="font-display text-2xl text-ink">{g.title}</h3>
              <ul className="mt-4 border-t border-ink">
                {g.sources.map((s) => (
                  <li key={s.id} className="grid gap-3 border-b border-rule py-5 md:grid-cols-[16rem_1fr_11rem] md:gap-8">
                    <div>
                      <a href={s.homepage} className="font-semibold text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-ink" rel="noopener noreferrer" target="_blank">
                        {s.name}
                      </a>
                      <p className="mt-1 text-sm text-ink-muted">Refreshed: {s.cadence}</p>
                      {s.needsKey ? <p className="mt-1 text-sm text-ink-muted">Needs a free API key, which the operator adds.</p> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[60ch] text-base text-ink">{s.covers}</p>
                      <p className="mt-2 text-sm text-ink-muted">
                        License: {s.license}
                        {s.termsUrl ? (
                          <>
                            {". "}
                            <a href={s.termsUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener noreferrer" target="_blank">
                              Terms of use
                            </a>
                          </>
                        ) : null}
                        {s.attribution ? `. ${s.attribution}` : ""}
                      </p>
                    </div>
                    <div className="md:text-right">
                      {s.count && s.count.open + s.count.forecasted > 0 ? (
                        <>
                          <p className="font-display text-2xl text-ink tnum">{nf.format(s.count.open + s.count.forecasted)}</p>
                          <p className="text-sm text-ink-muted">open or announced</p>
                        </>
                      ) : s.count ? (
                        <p className="text-sm text-ink-muted">{nf.format(s.count.total)} records</p>
                      ) : (
                        <p className="text-sm text-ink-muted">{s.kinds.length ? "Not loaded yet" : "Totals only"}</p>
                      )}
                      {s.count?.lastChecked ? <p className="mt-1 text-sm text-ink-muted">Checked {day(s.count.lastChecked)}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="rules-title" className="border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-20">
          <h2 id="rules-title" className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">
            How we keep it trustworthy
          </h2>
          <ul className="mt-8 border-t border-rule lg:mt-0">
            {principles.map((p) => (
              <li key={p} className="border-b border-rule py-4 text-base text-ink">
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto max-w-[75rem] px-4 pb-16 sm:px-6 lg:px-10">
          <p className="max-w-[65ch] text-base text-ink-muted">
            Missing a source you rely on, such as your state&apos;s bid portal or a community foundation?{" "}
            <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">
              Tell us which one
            </Link>
            . We add sources whose terms allow it.
          </p>
        </div>
      </section>
    </>
  );
}
