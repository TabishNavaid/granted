import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@/components/marketing/screenshot";
import { LogoMark } from "@/components/brand/logo";
import { dataPageStats } from "@/lib/catalog/stats";
import { faq } from "@/content/site";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${PRODUCT_NAME}: find and win the grants and public bids you qualify for` },
  description: `${PRODUCT_NAME} reads Grants.gov, SAM.gov, state and city bid portals, NIH, NSF, and the filings of private foundations every day, drafts each application from your own records with a source for every claim, and plans every deadline. Free during early access.`,
  alternates: { canonical: "/" },
};

// The counts on this page come from the database; read them at most every ten minutes.
export const revalidate = 600;

const nf = new Intl.NumberFormat("en-US");

const steps = [
  {
    n: "01",
    title: "It finds what you qualify for",
    body: "Tell it who you are once: your website, your documents, your work categories. It reads the database every morning and shows what fits, with the reason in your words and the line of the notice that supports it. Anything you could not apply for is set aside, with why.",
    shot: { name: "opportunities", alt: "Matches for a sample nonprofit, each with a fit score and the reasons behind it." },
  },
  {
    n: "02",
    title: "It drafts from your own records",
    body: "Letters, full proposals, bid responses, research proposals, and essays, written from your documents and records. Every claim links to the sentence it came from. When a fact is missing, the draft asks you instead of guessing.",
    shot: { name: "workspace", alt: "A proposal draft with a citation on every claim and the questions it could not answer." },
  },
  {
    n: "03",
    title: "You decide, and every date is planned",
    body: "Each deadline gets a plan worked back from the due date: go or no-go, questions due, drafts, review, signatures. Everything waits in one Inbox for a person to approve. Nothing is sent or submitted without you.",
    shot: { name: "calendar", alt: "The calendar with deadlines and the milestones planned back from each one." },
  },
];

const audiences = [
  {
    href: "/for/architecture-and-construction",
    name: "Architecture, engineering, and construction firms",
    finds: "Federal solicitations on SAM.gov and open bids from state and city portals, filtered by your NAICS codes, region, and set-asides.",
    drafts: "The compliance matrix, a go/no-go with reasons, the SF 330, and a proposal built from your projects and people.",
  },
  {
    href: "/for/nonprofits",
    name: "Nonprofits",
    finds: "Federal grants, and private foundations in every state from their IRS filings, including whether they accept applications.",
    drafts: "Letters of inquiry and full proposals from your annual report, your 990, and your website.",
  },
  {
    href: "/for/research",
    name: "Research teams",
    finds: "NIH and NSF notices, SBIR and STTR solicitations, and the programs that funded work like yours.",
    drafts: "Proposal sections, biosketches, and facilities from your records, with each funder's rules on AI on the checklist.",
  },
  {
    href: "/for/students",
    name: "Students and individuals",
    finds: "National scholarships and fellowships, each checked on the sponsor's own page, and foundations that give to individuals.",
    drafts: "Essays in your own voice, from your own experiences. It asks instead of inventing.",
  },
];

const never = [
  "Send, submit, post, or sign anything for you.",
  "Name a funder, a deadline, or an amount that is not in a public source we can link to.",
  "Put a number in a draft that is not in your records.",
  "Show who won a contract. Past awards are kept only as totals.",
  "Train AI models on your documents.",
];

export default async function HomePage() {
  const stats = await dataPageStats();
  const total = stats.totals.open + stats.totals.forecasted;
  const aec = stats.construction.federal + stats.construction.stateLocal;
  const sources = stats.sources.filter((s) => s.kinds.length > 0).length;
  const asOf = stats.asOf ? new Date(stats.asOf).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
  return (
    <>
      {/* Hero */}
      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:px-10 lg:pb-20 lg:pt-20">
          <div>
            <h1 className="max-w-[20ch] font-display text-[clamp(2.3rem,1.3rem+3.2vw,3.9rem)] leading-[1.04] text-ink">Find every grant and public bid you qualify for. Draft each one from your own records.</h1>
            <p className="mt-6 max-w-[56ch] text-lg text-ink-muted sm:text-xl">
              {PRODUCT_NAME} reads Grants.gov, SAM.gov, state and city bid portals, NIH, NSF, and the filings of private foundations every day. It drafts each application from your documents with a source for every claim, and plans every deadline. A person approves everything.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">Create a free workspace</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/onboarding?type=firm">Try it with a sample firm</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-muted">Free during early access. No card.</p>
          </div>

          {/* The register: live counts from the database */}
          <div className="self-end border-t-2 border-ink" aria-labelledby="counts-heading">
            <h2 id="counts-heading" className="sr-only">
              Open in the database
            </h2>
            <p className="pt-5 font-mono text-[clamp(2.6rem,1.8rem+2.6vw,3.75rem)] leading-none tracking-[-0.03em] text-ink tnum">{nf.format(total)}</p>
            <p className="mt-2 text-base text-ink">opportunities open or announced{stats.live ? " right now" : ""}</p>
            <dl className="mt-6 border-t border-rule text-base">
              {(
                [
                  ["Contracts and bids", stats.totals.byType.contract],
                  ["Federal and other grants", stats.totals.byType.grant],
                  ["Research funding", stats.totals.byType.research],
                  ["Scholarships and fellowships", stats.totals.byType.scholarship],
                  ["Private foundations on file", stats.totals.foundations],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="font-mono text-ink tnum">{nf.format(n)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-ink-muted">
              From {sources} official sources{asOf ? `, ${stats.live ? "counted" : "measured"} ${asOf}` : ""}.{" "}
              <Link href="/data" className="font-semibold text-ink underline underline-offset-4">
                See every source
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Construction, first and impossible to miss */}
      <section aria-labelledby="aec-heading" className="bg-ink text-on-ink">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className="text-base font-semibold text-on-ink-muted">For architecture, engineering, and construction firms</p>
              <h2 id="aec-heading" className="mt-3 max-w-[20ch] font-display text-[clamp(2rem,1.4rem+2vw,3rem)] leading-[1.08] text-on-ink">
                Read the solicitation once. Get the compliance matrix, the go/no-go, and the SF 330.
              </h2>
            </div>
            <div className="lg:pt-10">
              <p className="max-w-[52ch] text-lg text-on-ink-muted">
                Upload an RFP or pick one from the database. Every requirement becomes a row with the sentence and page it came from. The go/no-go weighs your capacity, bonding, and past work, with reasons. Sections are built from your projects and people, and the SF 330 exports to Word.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-on-ink-muted/40 pt-6">
                <div>
                  <dt className="text-sm text-on-ink-muted">Open federal construction and A/E solicitations</dt>
                  <dd className="mt-1 font-mono text-3xl text-on-ink tnum">{nf.format(stats.construction.federal)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-on-ink-muted">Open state and city construction bids</dt>
                  <dd className="mt-1 font-mono text-3xl text-on-ink tnum">{nf.format(stats.construction.stateLocal)}</dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="border-on-ink bg-on-ink text-ink hover:border-white hover:bg-white">
                  <Link href="/for/architecture-and-construction">See the construction path</Link>
                </Button>
                <Button asChild size="lg" variant="secondary" className="border-on-ink bg-transparent text-on-ink hover:bg-white/10">
                  <Link href="/onboarding?type=firm">Open the sample firm</Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-14">
            <Screenshot name="bid-matrix" tone="none" onDark alt={`The compliance matrix for a real VA solicitation in the sample firm's workspace: each requirement with its source sentence, page, and status. ${aec ? `${nf.format(aec)} open construction bids in the database.` : ""}`} caption="The compliance matrix for a real VA solicitation (36C25723R0049), in the sample firm's workspace." sizes="(min-width: 1200px) 1120px, 100vw" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 id="how-heading" className="max-w-[22ch] font-display text-4xl text-ink sm:text-5xl">
            A colleague who has every record in reach.
          </h2>
          <ol className="mt-12 flex flex-col gap-16">
            {steps.map((s) => (
              <li key={s.n} className="grid gap-8 border-t border-ink pt-6 lg:grid-cols-[1fr_1.5fr] lg:gap-14">
                <div>
                  <p className="font-mono text-sm text-ink-muted">{s.n}</p>
                  <h3 className="mt-2 font-display text-2xl text-ink sm:text-3xl">{s.title}</h3>
                  <p className="mt-4 max-w-[48ch] text-base text-ink-muted">{s.body}</p>
                </div>
                <Screenshot name={s.shot.name} alt={s.shot.alt} tone="sage" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Evidence */}
      <section aria-labelledby="evidence-heading" className="border-b border-rule bg-paper-tint">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <h2 id="evidence-heading" className="max-w-[16ch] font-display text-4xl text-ink sm:text-5xl">
              Every line shows where it came from.
            </h2>
            <p className="mt-6 max-w-[48ch] text-lg text-ink-muted">
              A requirement in the matrix quotes the solicitation. A claim in a draft links to your document. When the source is not there, the draft asks you a question instead of making something up.
            </p>
          </div>
          <figure className="sheet overflow-hidden">
            <div className="border-b border-rule px-5 py-3 text-sm text-ink-muted">
              <span className="font-mono text-ink">36C25723R0049</span>, amendment <span className="font-mono text-ink">A0002</span>, answer A4. Department of Veterans Affairs.
            </div>
            <blockquote className="px-5 py-5 text-base leading-relaxed text-ink">
              &ldquo;Whatever documents provided, from cover letter, SF330 and SAM screen shot is to be part of the entire submission and therefore, <mark className="bg-evidence px-0.5 text-ink">counts towards the limit to 20 pages</mark>.&rdquo;
            </blockquote>
            <div className="grid gap-px border-t border-rule bg-rule sm:grid-cols-[1fr_auto]">
              <div className="bg-paper px-5 py-4">
                <p className="text-sm text-ink-muted">In the compliance matrix</p>
                <p className="mt-1 text-base font-semibold text-ink">Whole submission, cover letter through SAM screenshot, within 20 pages.</p>
              </div>
              <div className="flex items-center bg-paper px-5 py-4">
                <span className="tag tag-ink">Checked against the draft</span>
              </div>
            </div>
            <figcaption className="border-t border-rule px-5 py-3 text-sm text-ink-muted">A real amendment to a real solicitation, read by the rules {PRODUCT_NAME} runs on every RFP. The sample firm&apos;s workspace is fictional.</figcaption>
          </figure>
        </div>
      </section>

      {/* Who it is for */}
      <section aria-labelledby="who-heading" className="border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 id="who-heading" className="max-w-[20ch] font-display text-4xl text-ink sm:text-5xl">
            One engine for four kinds of applicant.
          </h2>
          <ul className="mt-12 border-t border-ink">
            {audiences.map((a) => (
              <li key={a.href} className="grid gap-4 border-b border-rule py-7 lg:grid-cols-[1fr_1.2fr_1.2fr] lg:gap-10">
                <h3 className="font-display text-2xl text-ink">
                  <Link href={a.href} className="underline decoration-rule-strong decoration-[1.5px] underline-offset-[6px] hover:decoration-ink">
                    {a.name}
                  </Link>
                </h3>
                <div>
                  <p className="text-sm text-ink-muted">Finds</p>
                  <p className="mt-1 text-base text-ink">{a.finds}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-muted">Drafts</p>
                  <p className="mt-1 text-base text-ink">{a.drafts}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Never */}
      <section aria-labelledby="never-heading" className="border-b border-rule">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-16 lg:px-10 lg:py-24">
          <div>
            <LogoMark className="h-9 w-9 text-fellow" />
            <h2 id="never-heading" className="mt-6 max-w-[14ch] font-display text-4xl text-ink sm:text-5xl">
              What it will never do.
            </h2>
          </div>
          <ul className="border-t border-ink">
            {never.map((n) => (
              <li key={n} className="border-b border-rule py-4 text-lg text-ink">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Free */}
      <section aria-labelledby="free-heading" className="border-b border-rule bg-fellow-tint">
        <div className="mx-auto grid max-w-[75rem] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-16 lg:px-10">
          <h2 id="free-heading" className="font-display text-3xl text-ink sm:text-4xl">
            Free while we learn.
          </h2>
          <div>
            <p className="max-w-[56ch] text-lg text-ink">No paid plan, no card, and no trial that runs out. We want to find out whether this is truly useful before anyone pays for it. Each workspace has a monthly allowance of AI work, and searching the database never counts against it.</p>
            <p className="mt-4">
              <Link href="/free" className="font-semibold text-ink underline underline-offset-4">
                Why it is free, and the one limit
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section id="questions" aria-labelledby="faq-heading" className="scroll-mt-16 border-b border-rule">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 id="faq-heading" className="max-w-[12ch] font-display text-4xl text-ink sm:text-5xl">
            Questions people ask first.
          </h2>
          <div className="mt-10 border-t border-ink lg:mt-0">
            {faq.map((f) => (
              <details key={f.q} className="group border-b border-rule py-5">
                <summary className="cursor-pointer list-none text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-6">
                    {f.q}
                    <span aria-hidden className="font-mono text-ink-muted group-open:hidden">+</span>
                    <span aria-hidden className="hidden font-mono text-ink-muted group-open:inline">-</span>
                  </span>
                </summary>
                <p className="mt-3 max-w-[62ch] text-base text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section>
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 className="max-w-[20ch] font-display text-4xl text-ink sm:text-5xl">See what you qualify for this week.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Create a free workspace</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/onboarding">Try the demo with a sample</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
