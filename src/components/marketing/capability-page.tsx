import Link from "next/link";
import { Screenshot, type PanelTone } from "@/components/marketing/screenshot";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ClosingCta, DemoCta } from "@/components/marketing/demo-cta";
import { capabilities, type Capability } from "@/content/product";

const plantFor: Record<Capability["slug"], string> = {
  matching: "aster",
  drafting: "harebell",
  deadlines: "yarrow",
  outreach: "wind-poppy",
  connections: "camas",
  analytics: "phlox",
};

/** A capability page: what it does, a real screenshot, the steps, the specifics, and what it will never do. */
export function CapabilityPage({ capability: c }: { capability: Capability }) {
  const [first, second] = c.shots;
  const others = capabilities.filter((x) => x.slug !== c.slug);
  const secondTone: PanelTone = c.slug === "deadlines" || c.slug === "matching" ? "mist" : "sage";
  return (
    <div className="overflow-x-clip">
      <section>
        <div className="mx-auto max-w-[75rem] px-4 pt-14 sm:px-6 lg:px-10 lg:pt-20">
          <p className="text-base text-ink-muted">
            <Link href="/product" className="underline underline-offset-4 hover:text-ink">
              Product
            </Link>
            <span aria-hidden> / </span>
            <span className="text-ink">{c.name}</span>
          </p>
          <h1 className="mt-5 max-w-[18ch] font-display text-[clamp(2.6rem,1.5rem+3.6vw,4.5rem)] leading-[1.02] text-ink">{c.title}</h1>
          <p className="mt-6 max-w-[58ch] text-lg text-ink sm:text-xl">{c.lead}</p>
          <DemoCta className="mt-8" primary={false} />
        </div>
        <div className="mx-auto max-w-[75rem] px-4 pt-12 sm:px-6 lg:px-10 lg:pt-16">
          <Screenshot name={first.name} alt={first.alt} tone="cream" bleed="bottom" priority sizes="(min-width: 1200px) 1120px, 100vw" />
          <p className="mt-4 text-sm text-ink-muted">{first.caption}</p>
        </div>
      </section>

      <section className="mt-16 border-t border-rule lg:mt-24">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <SectionHeading plant={plantFor[c.slug]} className="max-w-[12ch] text-4xl sm:text-5xl lg:sticky lg:top-24 lg:self-start">
            How it works, step by step.
          </SectionHeading>
          <ol className="border-t border-rule">
            {c.steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.75rem_1fr] gap-x-4 border-b border-rule py-7 sm:grid-cols-[3.5rem_1fr]">
                <span className="font-display text-4xl leading-none text-meadow tnum" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-2xl text-ink">{s.title}</h3>
                  <p className="mt-2 max-w-[56ch] text-base text-ink-muted sm:text-lg">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {second ? (
        <section className="mx-auto max-w-[75rem] px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <Screenshot name={second.name} alt={second.alt} tone={secondTone} sizes="(min-width: 1200px) 1120px, 100vw" />
          <p className="mt-4 text-sm text-ink-muted">{second.caption}</p>
        </section>
      ) : null}

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 className="max-w-[12ch] font-display text-4xl text-ink sm:text-5xl lg:sticky lg:top-24 lg:self-start">The specifics</h2>
          <dl className="border-t border-ink">
            {c.specs.map((s) => (
              <div key={s.label} className="grid gap-1 border-b border-rule py-5 sm:grid-cols-[12rem_1fr] sm:gap-8">
                <dt className="font-semibold text-ink">{s.label}</dt>
                <dd className="max-w-[58ch] text-base text-ink-muted">{s.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <NeverBand items={c.never} />

      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <div>
            <h2 className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">The rest of the product</h2>
            <p className="mt-4 max-w-[36ch] text-base text-ink-muted">
              Or follow one application from start to finish on{" "}
              <Link href="/how-it-works" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4">
                how it works
              </Link>
              .
            </p>
          </div>
          <ul className="border-t border-rule">
            {others.map((o) => (
              <li key={o.slug} className="border-b border-rule">
                <Link href={`/product/${o.slug}`} className="group block py-5">
                  <span className="font-display text-2xl text-ink underline-offset-4 group-hover:underline">{o.name}</span>
                  <span className="mt-1 block max-w-[58ch] text-base text-ink-muted">{o.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCta />
    </div>
  );
}

/** The one dark band on a product page: the things it will never do, stated plainly. */
export function NeverBand({ items, title = "What it will never do", lead }: { items: string[]; title?: string; lead?: string }) {
  return (
    <section className="bg-ink text-on-ink">
      <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
        <div>
          <h2 className="max-w-[12ch] font-display text-4xl leading-[1.05] text-on-ink sm:text-5xl">{title}</h2>
          {lead ? <p className="mt-5 max-w-[38ch] text-lg text-on-ink-muted">{lead}</p> : null}
        </div>
        <ul className="border-t border-white/20 text-base sm:text-lg">
          {items.map((t) => (
            <li key={t} className="max-w-[56ch] border-b border-white/20 py-4">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
