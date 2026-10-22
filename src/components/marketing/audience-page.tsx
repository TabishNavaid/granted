import Link from "next/link";
import { Screenshot, type PanelTone } from "@/components/marketing/screenshot";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ClosingCta, DemoCta } from "@/components/marketing/demo-cta";
import { NeverBand } from "@/components/marketing/capability-page";
import { audiencePages, type AudiencePage, type AudienceStep } from "@/content/audience-pages";

const tones: PanelTone[] = ["sage", "mist", "cream"];

/**
 * An audience page under /for: the problem in plain words, what the product
 * does step by step (each step with a real screenshot when one exists), what
 * it will never do, what it needs from you, and the two calls to action.
 */
export function AudiencePageView({ page: a }: { page: AudiencePage }) {
  const others = audiencePages.filter((x) => x.slug !== a.slug);
  const labels = { signUpLabel: a.signUpLabel, demoLabel: a.demoLabel, demoNote: a.demo };
  // Steps with a screenshot alternate sides and panel colors, counted among themselves.
  const shotIndex = a.steps.map((s, i) => a.steps.slice(0, i).filter((x) => x.shot).length);
  return (
    <div className="overflow-x-clip">
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 pb-14 pt-14 sm:px-6 lg:px-10 lg:pb-20 lg:pt-20">
          <p className="text-base text-ink-muted">
            <Link href="/who-its-for" className="underline underline-offset-4 hover:text-ink">
              Who it&apos;s for
            </Link>
            <span aria-hidden> / </span>
            <span className="text-ink">{a.name}</span>
          </p>
          <SectionHeading as="h1" plant={a.plant} className="mt-5 max-w-[18ch] text-[clamp(2.6rem,1.5rem+3.6vw,4.5rem)] leading-[1.02]">
            {a.title}
          </SectionHeading>
          <p className="mt-6 max-w-[60ch] text-lg text-ink sm:text-xl">{a.lead}</p>
          <DemoCta className="mt-8" {...labels} />
        </div>
      </section>

      <section aria-labelledby="problem">
        <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 id="problem" className="max-w-[18ch] font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            {a.problem.heading}
          </h2>
          <div className="lg:pt-2">
            {a.problem.body.map((p) => (
              <p key={p} className="mt-5 max-w-[56ch] text-lg text-ink-muted first:mt-0 sm:text-xl">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps" className="border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 id="steps" className="max-w-[16ch] font-display text-4xl text-ink sm:text-5xl lg:text-6xl">
            What it does, step by step.
          </h2>
          <ol className="mt-14 flex flex-col gap-16 lg:mt-20 lg:gap-24">
            {a.steps.map((s, i) => {
              if (!s.shot) {
                return (
                  <li key={s.title}>
                    <StepText step={s} n={i + 1} />
                  </li>
                );
              }
              const k = shotIndex[i];
              const flip = k % 2 === 1;
              return (
                <li key={s.title} className={`grid items-center gap-8 lg:gap-14 ${flip ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-[2fr_3fr]"}`}>
                  <StepText step={s} n={i + 1} className={flip ? "lg:order-2" : undefined} />
                  <Screenshot name={s.shot.name} alt={s.shot.alt} caption={s.shot.caption} tone={tones[k % tones.length]} bleed={flip ? "left" : "right"} className={flip ? "lg:order-1" : undefined} />
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <NeverBand items={a.never} />

      <section aria-labelledby="needs">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 id="needs" className="max-w-[12ch] font-display text-4xl text-ink sm:text-5xl lg:sticky lg:top-24 lg:self-start">
            What it needs from you
          </h2>
          <div>
            <dl className="border-t border-ink">
              {a.needs.map((n) => (
                <div key={n.label} className="grid gap-1 border-b border-rule py-5 sm:grid-cols-[13rem_1fr] sm:gap-8">
                  <dt className="font-semibold text-ink">{n.label}</dt>
                  <dd className="max-w-[58ch] text-base text-ink-muted">{n.body}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-12 font-display text-2xl text-ink">Good to know</h3>
            <ul className="mt-4 border-t border-rule">
              {a.goodToKnow.map((g) => (
                <li key={g} className="max-w-[62ch] border-b border-rule py-3.5 text-base text-ink">
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="others" className="border-t border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-20 lg:px-10 lg:py-24">
          <div>
            <h2 id="others" className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">
              Who else it is for
            </h2>
            <p className="mt-4 max-w-[36ch] text-base text-ink-muted">
              Or read{" "}
              <Link href="/who-its-for" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4">
                who it is for, and what is limited today
              </Link>
              .
            </p>
          </div>
          <ul className="border-t border-rule">
            {others.map((o) => (
              <li key={o.slug} className="border-b border-rule">
                <Link href={`/for/${o.slug}`} className="group block py-5">
                  <span className="font-display text-2xl text-ink underline-offset-4 group-hover:underline">{o.linkLabel}</span>
                  <span className="mt-1 block max-w-[58ch] text-base text-ink-muted">{o.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingCta title={a.closing.title} lead={a.closing.lead} note={a.closing.note ?? null} {...labels} />
    </div>
  );
}

function StepText({ step, n, className }: { step: AudienceStep; n: number; className?: string }) {
  return (
    <div className={className}>
      <span className="block font-display text-6xl leading-[0.85] tracking-[-0.03em] text-fellow tnum" aria-hidden>
        {n}
      </span>
      <h3 className="mt-4 max-w-[22ch] font-display text-3xl text-ink">{step.title}</h3>
      <p className="mt-4 max-w-[52ch] text-lg text-ink-muted">{step.body}</p>
    </div>
  );
}
