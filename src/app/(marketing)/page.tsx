import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@/components/marketing/screenshot";
import { Plate } from "@/components/marketing/plate";
import { DEMO_HREF, DEMO_LABEL, DEMO_NOTE, DemoCta } from "@/components/marketing/demo-cta";
import { Drawing } from "@/components/drawings/drawing";
import { Meadow } from "@/components/drawings/meadow";
import { drawing, plates } from "@/lib/drawings";
import { faq } from "@/content/site";
import { checked, helpCosts, source } from "@/content/costs";
import { audiencePages } from "@/content/audience-pages";
import * as demo from "@/lib/mock/data";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: ${PRODUCT_TAGLINE.replace(/\.$/, "").toLowerCase()}`,
  description: `${PRODUCT_NAME} is for organizations that win work through applications and proposals: nonprofits, architecture and construction firms, research teams, and students. It finds what you can apply for, drafts from your own records with a source on every claim, and keeps every deadline. Nothing moves without you.`,
  alternates: { canonical: "/" },
};

const problem = [
  "A nonprofit director writes grants at night. A firm's principal reads the solicitation on a weekend. A researcher writes between classes. A senior writes essays after practice.",
  "Hiring help costs more each month than most of them can spare. A grant writer on retainer can cost $2,000 a month.",
  "The AI tools that would help will write anything, including numbers, projects, and experiences that were never true.",
];

const steps = [
  { n: "1", title: "Paste your website", body: "We read your pages and write down the facts a funder asks for. Each one links to the sentence it came from. You check them before anything uses them.", shot: "profile", alt: "The confirm screen: facts about the organization, each with a source link." },
  { n: "2", title: "See grants you can apply for", body: "We search Grants.gov for open and forecast notices that 501(c)(3) organizations can apply for, read the best ones in full, and score each against your facts in plain words.", shot: "opportunities", alt: "The opportunities list: funders ranked by fit, each with a score, deadline, award range, and reasons." },
  { n: "3", title: "Get a letter that only says what is true", body: "One click drafts a one-page letter of inquiry. Every claim cites a fact you confirmed. Anything we do not know becomes a question for you.", shot: "workspace", alt: "The proposal workspace: a drafted letter with citation chips, a checklist, and open questions on the right." },
];

const trust = [
  "Every funder and deadline comes from a page we fetched, with the link and the date we checked it.",
  "Every claim about your organization cites a fact you confirmed. A missing fact becomes a question, not a plausible number.",
  "We never send, post, or submit. You copy the email. You click submit on the funder's portal.",
  "Your data stays in your workspace. We use the AI provider's paid tier, which does not train on it. One click deletes everything.",
  "The Activity screen shows each step an agent took, each page it read, and what it cost.",
];

/** Footnotes for the cost section, numbered in the order they first appear. */
const costSources = Array.from(new Set(helpCosts.flatMap((c) => c.sources)));
const costNote = (id: string) => costSources.indexOf(id) + 1;

/** The demo match the green section is about, straight from the demo workspace. */
const featured = (() => {
  const match = demo.matches.find((m) => m.id === "match_meridian")!;
  const opportunity = demo.opportunities.find((o) => o.id === match.opportunityId)!;
  const funder = demo.funders.find((f) => f.id === opportunity.funderId)!;
  return { match, opportunity, funder };
})();

/**
 * A section heading, with at most one small watercolor plant. The plant
 * stands on the baseline of the heading's last line, right after the last
 * word, so it is always in the same place relative to the type.
 */
function SectionHeading({ plant, className, children }: { plant?: string; className?: string; children: string }) {
  // The last word and the plant never break apart, so the plant cannot wrap onto a line of its own.
  const cut = children.lastIndexOf(" ");
  const head = children.slice(0, cut + 1);
  const last = children.slice(cut + 1);
  return (
    <h2 className={`font-display text-4xl text-ink sm:text-5xl lg:text-6xl ${className ?? ""}`}>
      {head}
      <span className="whitespace-nowrap">
        {last}
        {plant ? (
          <span aria-hidden className="relative ml-[0.2em] inline-block h-0 w-[0.8em] align-baseline">
            <Drawing asset={drawing(plant)} className="absolute bottom-[-0.04em] left-0 h-[1em] w-auto" />
          </span>
        ) : null}
      </span>
    </h2>
  );
}

export default function LandingPage() {
  const lupine = plates[0];
  return (
    <div className="overflow-x-clip">
      {/* Hero: the headline beside one painting, and a strip of wildflowers that grows up as the page loads. */}
      <section>
        <div className="mx-auto grid max-w-[75rem] items-end gap-12 px-4 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_22rem] lg:gap-16 lg:px-10 lg:pt-20 xl:grid-cols-[1fr_25rem]">
          <div className="pb-4 lg:pb-16">
            <h1 className="max-w-[15ch] font-display text-[clamp(3.1rem,1.4rem+5.2vw,6rem)] leading-[0.98] text-ink">Grants, bids, and scholarships from your own records.</h1>
            <p className="mt-8 max-w-[48ch] text-lg text-ink sm:text-xl">
              For anyone who wins work by applying for it: nonprofits, architecture and construction firms, research teams, and students. {PRODUCT_NAME} finds what you can apply for, drafts from your own records with a source on every claim, and keeps every deadline. You read it and approve it. Nothing moves without you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="h-auto min-h-12 max-w-full whitespace-normal py-2.5 text-center">
                <Link href={DEMO_HREF}>{DEMO_LABEL}</Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-ink-muted">Free to start. First matches in about ten minutes.</p>
            <p className="mt-1 text-sm text-ink-muted">{DEMO_NOTE}</p>
          </div>
          {lupine ? <Plate plate={lupine} eager className="w-[68%] max-w-[22rem] sm:w-full lg:mb-10 lg:max-w-none" /> : null}
        </div>
        <Meadow seed="hero" count={12} mobileMax={7} grow className="-mt-2 h-36 border-b border-rule sm:h-48" />
      </section>

      {/* The product, at full width, on a cream panel the color of Walcott's paper. */}
      <section className="mx-auto max-w-[75rem] px-4 pt-14 sm:px-6 lg:px-10 lg:pt-20">
        <Screenshot name="inbox" tone="cream" bleed="bottom" priority sizes="(min-width: 1200px) 1120px, 100vw" alt="The Inbox: this month's plan, and the drafts, emails, and questions waiting for approval." />
        <p className="mt-4 text-sm text-ink-muted">The Inbox, on demo data. Everything {PRODUCT_NAME} does waits here until you approve it.</p>
      </section>

      {/* Problem */}
      <section>
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:px-10 lg:py-32">
          <h2 className="max-w-[12ch] font-display text-5xl leading-[1.02] text-ink sm:text-6xl lg:text-[5.5rem]">
            The writing falls on <span className="text-meadow">one person.</span>
          </h2>
          <ul className="self-end border-t border-rule text-lg text-ink sm:text-xl">
            {problem.map((p) => (
              <li key={p} className="max-w-[46ch] border-b border-rule py-5">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who it is for: the four audience pages. */}
      <section id="who" aria-labelledby="who-heading" className="scroll-mt-16 border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end lg:gap-20">
            <h2 id="who-heading" className="max-w-[18ch] font-display text-4xl text-ink sm:text-5xl">
              Four kinds of applicants, one way of working.
            </h2>
            <p className="max-w-[48ch] text-lg text-ink-muted">Each starts from what it already has: a website, a firm&apos;s projects and people, a lab page, or a résumé. Every draft cites those records, and you approve every step.</p>
          </div>
          <ul className="mt-12 grid border-t border-ink md:grid-cols-2 lg:mt-16">
            {audiencePages.map((a) => (
              <li key={a.slug} className="border-b border-rule md:odd:border-r md:odd:pr-10 md:even:pl-10">
                <Link href={`/for/${a.slug}`} className="group block py-8">
                  <span className="block font-display text-3xl text-ink underline-offset-[6px] group-hover:underline">{a.name}</span>
                  <span className="mt-2 block max-w-[48ch] text-base text-ink-muted sm:text-lg">{a.summary}</span>
                  <span className="mt-3 block text-base font-semibold text-ink underline decoration-[1.5px] underline-offset-4">{a.linkLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works: three steps, three layouts. */}
      <section id="how" className="scroll-mt-16 border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <SectionHeading plant="harebell" className="max-w-[16ch]">
            Three steps. The last one is yours.
          </SectionHeading>
          <p className="mt-6 max-w-[58ch] text-lg text-ink-muted">Here they are for a nonprofit. A firm starts from its projects and an RFP, a research team from its lab page, and a student from a résumé; each has its own page above.</p>

          <ol className="mt-16 flex flex-col gap-20 lg:mt-20 lg:gap-28">
            {/* Step one: words left, screenshot right, running off its panel. */}
            <li className="grid items-center gap-8 lg:grid-cols-[2fr_3fr] lg:gap-14">
              <StepText step={steps[0]} />
              <Screenshot name={steps[0].shot} alt={steps[0].alt} tone="sage" bleed="right" />
            </li>
            {/* Step two: screenshot left. */}
            <li className="grid items-center gap-8 lg:grid-cols-[3fr_2fr] lg:gap-14">
              <StepText step={steps[1]} className="lg:order-2" />
              <Screenshot name={steps[1].shot} alt={steps[1].alt} tone="mist" bleed="left" className="lg:order-1" />
            </li>
            {/* Step three: words above, screenshot across the whole width. */}
            <li>
              <StepText step={steps[2]} />
              <Screenshot name={steps[2].shot} alt={steps[2].alt} tone="cream" className="mt-10" sizes="(min-width: 1200px) 1120px, 100vw" />
            </li>
          </ol>
        </div>
      </section>

      {/* The one full-bleed meadow green section: matching, with the number large. */}
      <section id="matching" className="scroll-mt-16 bg-meadow text-white">
        <div className="mx-auto grid max-w-[75rem] items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.35fr] lg:gap-16 lg:px-10 lg:py-28">
          <div>
            <h2 className="max-w-[14ch] font-display text-4xl text-white sm:text-5xl">Every match comes with its reasons.</h2>
            <div className="mt-10 flex items-end gap-5">
              <p className="font-display text-[8rem] leading-[0.8] tracking-[-0.04em] text-white tnum sm:text-[10rem]">
                <span className="sr-only">Fit score </span>
                {featured.match.fitScore}
              </p>
              <div className="pb-2 text-base text-white/85">
                <p className="font-semibold text-white">Strong fit</p>
                <p>{featured.opportunity.title}</p>
                <p>{featured.funder.name}</p>
              </div>
            </div>
            <ul className="mt-8 border-t border-white/25 text-base sm:text-lg">
              {featured.match.reasons.map((r) => (
                <li key={r} className="max-w-[48ch] border-b border-white/25 py-3.5">
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-[48ch] text-sm text-white/80">If you cannot apply, you never see it. The source page and the date we checked it are one click away. Demo data.</p>
          </div>
          <Screenshot name="opportunity" alt="An opportunity page with fit reasons, eligibility checks, and the verified source link." tone="meadow" bleed="right" />
        </div>
      </section>

      {/* Drafts and outreach as plain words, deadlines with a picture. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="grid gap-12 border-b border-rule pb-16 md:grid-cols-2 md:gap-16 lg:pb-20">
            <div id="drafts" className="scroll-mt-20">
              <h2 className="max-w-[16ch] font-display text-3xl text-ink lg:text-4xl">Drafts built from your own sources</h2>
              <p className="mt-4 max-w-[46ch] text-lg text-ink-muted">Letters and proposals use facts you confirmed and the funder&apos;s own text, with citations inline. After drafting, code checks every citation and every number. Anything that fails becomes a marked gap and a question in the side panel.</p>
            </div>
            <div id="outreach" className="scroll-mt-20">
              <h2 className="max-w-[16ch] font-display text-3xl text-ink lg:text-4xl">Emails you send yourself</h2>
              <p className="mt-4 max-w-[46ch] text-lg text-ink-muted">Questions for a program officer, cover notes, thank-yous, and follow-ups are drafted for you. You read them and send them from your own address. Nothing goes out on its own.</p>
            </div>
          </div>
          <div id="deadlines" className="grid scroll-mt-20 items-center gap-10 pt-16 lg:grid-cols-[2fr_3fr] lg:gap-14 lg:pt-20">
            <div>
              <h2 className="max-w-[14ch] font-display text-3xl text-ink lg:text-4xl">Deadlines, planned backward</h2>
              <p className="mt-4 max-w-[44ch] text-lg text-ink-muted">Each application gets milestones counted back from the deadline: draft due, board review, budget sign-off, submit. They sit on one calendar you can subscribe to from your own.</p>
            </div>
            <Screenshot name="calendar" alt="The calendar with deadlines and milestones across a month." tone="sage" />
          </div>
        </div>
      </section>

      {/* The one dark band: trust, with the wildflowers against the ink. */}
      <section id="trust" className="scroll-mt-16 bg-ink text-on-ink">
        <div className="mx-auto grid max-w-[75rem] gap-12 px-4 pb-6 pt-20 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-20 lg:px-10 lg:pt-28">
          <div>
            <h2 className="max-w-[12ch] font-display text-5xl leading-[1.02] text-on-ink lg:text-6xl">Nothing leaves without you.</h2>
            <p className="mt-6 max-w-[38ch] text-lg text-on-ink-muted">Funders can spot a made-up number from across the room. So can you.</p>
            <Link href="/security" className="mt-8 inline-flex h-12 items-center rounded-md border-[1.5px] border-on-ink px-6 text-lg font-bold text-on-ink transition-colors hover:bg-on-ink hover:text-ink">
              How we handle your data
            </Link>
          </div>
          <ul className="border-t border-white/20 text-base sm:text-lg">
            {trust.map((t) => (
              <li key={t} className="max-w-[56ch] border-b border-white/20 py-4">
                {t}
              </li>
            ))}
          </ul>
        </div>
        <Meadow seed="trust" count={11} mobileMax={6} onDark className="h-40 opacity-95 sm:h-56" />
      </section>

      {/* What help costs: hiring a writer next to our plans. */}
      <section id="costs" className="scroll-mt-16">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 pt-20 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-20 lg:px-10 lg:pt-28">
          <div>
            <h2 className="max-w-[12ch] font-display text-4xl text-ink sm:text-5xl">What help costs</h2>
            <p className="mt-5 max-w-[38ch] text-lg text-ink-muted">What hiring grant help typically costs, and what we charge. With either, you still review and submit.</p>
          </div>
          <div>
            <dl className="border-t border-ink">
              {helpCosts.map((c) => (
                <div key={c.label} className="grid gap-1 border-b border-rule py-5 sm:grid-cols-[12rem_1fr] sm:gap-8">
                  <dt className="font-semibold text-ink">{c.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl text-ink tnum">
                      {c.cost}
                      {c.sources.length ? (
                        <sup className="ml-0.5 font-body text-xs">
                          {c.sources.map((id, i) => (
                            <span key={id}>
                              {i > 0 ? ", " : null}
                              <a href={`#cost-source-${costNote(id)}`} className="text-ink-muted underline underline-offset-2 hover:text-ink" aria-label={`${costNote(id)}, source: ${source(id).publisher}`}>
                                {costNote(id)}
                              </a>
                            </span>
                          ))}
                        </sup>
                      ) : null}
                    </span>
                    <span className="mt-1 block max-w-[52ch] text-base text-ink-muted">{c.detail}</span>
                  </dd>
                </div>
              ))}
              <div className="grid gap-1 border-b border-rule bg-panel-sage/60 px-3 py-5 sm:-mx-3 sm:grid-cols-[12rem_1fr] sm:gap-8">
                <dt className="font-semibold text-ink">{PRODUCT_NAME}</dt>
                <dd>
                  <span className="block font-display text-2xl text-meadow tnum">Free during early access</span>
                  <span className="mt-1 block max-w-[52ch] text-base text-ink-muted">No card and no paid plan. It finds the grants, drafts from your facts, and keeps the dates. It does not replace a writer&apos;s judgment or relationships.</span>
                </dd>
              </div>
            </dl>
            <ol className="mt-5 flex flex-col gap-1 text-xs leading-relaxed text-ink-muted">
              {costSources.map((id) => {
                const s = source(id);
                return (
                  <li key={id} id={`cost-source-${costNote(id)}`} className="scroll-mt-24">
                    {costNote(id)}.{" "}
                    <a href={s.url} className="underline underline-offset-2 hover:text-ink" rel="noopener noreferrer" target="_blank">
                      {s.publisher}, {s.title}
                    </a>
                    . Accessed {checked.long}.
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Free */}
      <section id="free" className="scroll-mt-16">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <SectionHeading plant="aster" className="max-w-[17ch]">
            Free while we learn.
          </SectionHeading>
          <p className="mt-6 max-w-[58ch] text-lg text-ink-muted">No paid plan, no card, and no trial that runs out. We want to learn whether this is truly useful before anyone pays for it.</p>
          <p className="mt-5 max-w-[60ch] text-base text-ink-muted">
            <Link href="/free" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-ink">
              Why it is free, and the one limit
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="questions" className="scroll-mt-16 border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-28">
          <SectionHeading plant="wind-poppy" className="max-w-[12ch] lg:text-5xl">
            Questions a careful director asks first.
          </SectionHeading>
          <div className="mt-10 border-t border-rule lg:mt-0">
            {faq.map((f) => (
              <details key={f.q} className="group border-b border-rule py-5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 rounded-sm font-display text-xl text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="font-body text-base text-ink-muted group-open:hidden" aria-hidden>
                    Show
                  </span>
                  <span className="hidden font-body text-base text-ink-muted group-open:inline" aria-hidden>
                    Hide
                  </span>
                </summary>
                <p className="mt-3 max-w-[60ch] text-base text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing, over a meadow that stands on the footer rule. */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[75rem] px-4 pb-10 pt-20 sm:px-6 lg:px-10 lg:pt-28">
          <h2 className="max-w-[14ch] font-display text-5xl leading-[1.02] text-ink sm:text-6xl lg:text-[5.5rem]">Start with what you already have.</h2>
          <p className="mt-6 max-w-[44ch] text-lg text-ink-muted">A website, a lab page, a résumé, or the RFP in front of you. Free to start, and nothing is sent without you.</p>
          <DemoCta className="mt-8" />
        </div>
        <Meadow seed="closing" count={12} mobileMax={7} className="h-40 opacity-90 sm:h-56" />
      </section>
    </div>
  );
}

function StepText({ step, className }: { step: (typeof steps)[number]; className?: string }) {
  return (
    <div className={className}>
      <span className="block font-display text-[5.5rem] leading-[0.85] tracking-[-0.03em] text-meadow tnum" aria-hidden>
        {step.n}
      </span>
      <h3 className="mt-5 max-w-[18ch] font-display text-3xl text-ink lg:text-4xl">{step.title}</h3>
      <p className="mt-4 max-w-[46ch] text-lg text-ink-muted">{step.body}</p>
    </div>
  );
}
