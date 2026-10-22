"use client";

import * as React from "react";
import { services } from "@/lib/services";
import { formatMoney } from "@/lib/format";

type Market = Awaited<ReturnType<typeof services.bids.marketContext>>;

/** Who buys this kind of work, how often, and for how much, from federal award totals. Never who won. */
export function MarketPanel({ applicationId }: { applicationId: string }) {
  const [m, setM] = React.useState<Market | undefined>(undefined);
  React.useEffect(() => {
    let alive = true;
    services.bids
      .marketContext(applicationId)
      .then((r) => alive && setM(r))
      .catch(() => alive && setM(null));
    return () => {
      alive = false;
    };
  }, [applicationId]);
  if (m === undefined) return <p className="text-sm text-ink-muted">Reading past awards for this kind of work.</p>;
  if (!m) return null;
  const c = m.context;
  const money = (n: number | null) => (n == null ? "Not reported" : formatMoney(n));
  return (
    <section aria-labelledby="market" className="border-t border-ink pt-5">
      <h2 id="market" className="font-display text-xl text-ink">
        Who buys this work
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        New federal contract awards under NAICS <span className="font-mono text-ink">{c.naics}</span> in fiscal year {c.fiscalYear}, from USAspending.gov{m.recordedOn ? `, recorded ${m.recordedOn}` : ""}. Totals only; who won is never shown.
      </p>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">Agencies that bought this kind of work, by dollars</caption>
        <thead className="border-b border-rule text-ink-muted">
          <tr>
            <th className="py-1.5 pr-3 font-normal">Agency</th>
            <th className="py-1.5 pr-3 text-right font-normal">Awards</th>
            <th className="py-1.5 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {c.buyers.map((b) => (
            <tr key={b.agency} className="border-b border-rule">
              <td className="py-1.5 pr-3 text-ink">{b.agency}</td>
              <td className="py-1.5 pr-3 text-right font-mono text-ink tnum">{b.awards}</td>
              <td className="py-1.5 text-right font-mono text-ink tnum">{formatMoney(Math.round(b.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {c.local.length ? (
        <>
          <h3 className="mt-6 text-base font-semibold text-ink">In your states</h3>
          <ul className="mt-2 border-t border-rule">
            {c.local.map((l, i) => (
              <li key={i} className="border-b border-rule py-2 text-sm">
                <p className="text-ink">
                  {l.office ?? l.agency}, {l.state}
                </p>
                <p className="text-ink-muted">
                  {l.awards} award{l.awards === 1 ? "" : "s"}. Typical size {money(l.median)}
                  {l.p25 != null && l.p75 != null && l.awards >= 4 ? `, middle half from ${money(l.p25)} to ${money(l.p75)}` : ""}.
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {c.setAsides.length ? (
        <p className="mt-4 text-sm text-ink-muted">
          Set-asides reported: {c.setAsides.map((s) => `${s.label} (${s.awards})`).join(", ")}.
        </p>
      ) : null}
      <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block py-1 text-sm text-ink underline underline-offset-4">
        Search these awards on USAspending.gov<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
