import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@/components/marketing/screenshot";
import { faq, pricingTiers } from "@/content/site";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: ${PRODUCT_TAGLINE.replace(/\.$/, "").toLowerCase()}`,
  description: `${PRODUCT_NAME} finds federal grants you can apply for, drafts a letter of inquiry from facts on your own website, and keeps every deadline. You read it, you approve it, nothing moves without you.`,
  alternates: { canonical: "/" },
};

const problem = [
  "Most small nonprofits have nobody whose job is grants, so the executive director writes proposals at night.",
  "The databases that would help cost more a month than the organization can spare.",
  "The AI tools that would help write anything, including numbers that were never true.",
];

const steps = [
  { n: "1", title: "Paste your website", body: "We read your pages and write down the facts a funder asks for, each one linked to the exact sentence it came from. You check them before anything is used.", shot: "profile", alt: "The confirm screen: a list of facts about the organization, each with a source link." },
  { n: "2", title: "See grants you can actually apply for", body: "We search Grants.gov for open and announced notices that 501(c)(3) nonprofits can apply for, read the strongest ones in full, and score each against your facts with plain reasons.", shot: "opportunities", alt: "The opportunities list: funders ranked by fit, each with a score, deadline, award range, and reasons." },
  { n: "3", title: "Get a letter that only says what is true", body: "One click drafts a one-page letter of inquiry. Every claim carries a citation to a fact you confirmed. Anything we do not know becomes a question for you, never a guess.", shot: "workspace", alt: "The proposal workspace: a drafted letter with citation chips, a checklist, and open questions on the right." },
];

const features = [
  { id: "matching", title: "Matching with reasons, not a feed", body: "Every match says why it fits in two or three sentences, each tied to one of your facts and one line of the funder's notice. If you cannot apply, you never see it. The source page and the date we checked it are always one click away.", shot: "opportunity", alt: "An opportunity detail page with fit reasons, eligibility checks, and the verified source link." },
  { id: "drafts", title: "Drafts grounded in your own sources", body: "Letters and proposals are written from facts you confirmed and the funder's own text. Citations sit inline. After drafting, code checks every citation and every number; whatever fails becomes a highlighted gap and a question in the side panel.", shot: "workspace", alt: "The section editor with inline citation chips and a questions panel." },
  { id: "deadlines", title: "Deadlines, planned backward", body: "Each application gets milestones worked back from the deadline: draft due, board review, budget sign-off, submit. They live on one calendar you can subscribe to from your own.", shot: "calendar", alt: "The calendar with deadlines and milestones across a month." },
  { id: "outreach", title: "Outreach you send yourself", body: "Questions to a program officer, cover notes, thank-yous, and follow-ups are drafted for you. You read them, then send them from your own address. Nothing goes out on its own.", shot: "inbox", alt: "The Inbox with a drafted email waiting for approval." },
];

const trust = [
  "Every funder and deadline comes from a real page we fetched, with the link and the date we checked it. Nothing is named from memory.",
  "Every claim about your organization cites a fact you confirmed. A missing fact becomes a question, never a plausible number.",
  "We never send, post, or submit. You copy the email. You click submit on the portal.",
  "Your data stays in your workspace. On paid plans the AI provider does not train on it. One click deletes everything.",
  "The Activity screen shows every step an agent took, every page it read, and what it cost.",
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-[75rem] px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-24">
        <h1 className="max-w-[12ch] font-display text-display tracking-[-0.03em] text-ink">{PRODUCT_TAGLINE}</h1>
        <p className="mt-8 max-w-[52ch] text-lg text-ink sm:text-xl">
          {PRODUCT_NAME} finds grants you can apply for, drafts the letter from facts on your own website, and keeps every deadline. You read it. You approve it. Nothing moves without you.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Find my first grants</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="#how">See how it works</Link>
          </Button>
        </div>
        <p className="mt-3 text-sm text-ink-muted">Free to start. First matches in about ten minutes.</p>
        <div className="mt-14 lg:mt-20">
          <Screenshot name="inbox" alt="The Inbox: this month's plan and the drafts, emails, and questions waiting for approval." priority />
        </div>
      </section>

      {/* Problem */}
      <section className="border-t-2 border-ink">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 className="max-w-[14ch] font-display text-4xl text-ink lg:text-5xl">The grant work falls on one person.</h2>
          <ul className="border-t border-rule text-lg text-ink sm:text-xl">
            {problem.map((p) => (
              <li key={p} className="max-w-[52ch] border-b border-rule py-5">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-t-2 border-ink">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 className="max-w-[18ch] font-display text-4xl text-ink lg:text-5xl">Three steps. The last one is yours.</h2>
          <ol className="mt-14 flex flex-col gap-16 lg:gap-24">
            {steps.map((s, i) => (
              <li key={s.n} className={`grid items-start gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16 ${i % 2 ? "lg:[&>*:first-child]:order-2 lg:grid-cols-[3fr_2fr]" : ""}`}>
                <div>
                  <span className="font-display text-6xl leading-none text-ink tnum" aria-hidden>
                    {s.n}
                  </span>
                  <h3 className="mt-5 max-w-[20ch] font-display text-3xl text-ink">{s.title}</h3>
                  <p className="mt-4 max-w-[48ch] text-lg text-ink-muted">{s.body}</p>
                </div>
                <Screenshot name={s.shot} alt={s.alt} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      {features.map((f, i) => (
        <section key={f.id} id={f.id} className="scroll-mt-16 border-t-2 border-ink">
          <div className={`mx-auto grid max-w-[75rem] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[2fr_3fr] lg:gap-20 lg:px-10 lg:py-24 ${i % 2 ? "lg:[&>*:first-child]:order-2 lg:grid-cols-[3fr_2fr]" : ""}`}>
            <div>
              <h2 className="max-w-[18ch] font-display text-3xl text-ink lg:text-4xl">{f.title}</h2>
              <p className="mt-4 max-w-[48ch] text-lg text-ink-muted">{f.body}</p>
            </div>
            <Screenshot name={f.shot} alt={f.alt} />
          </div>
        </section>
      ))}

      {/* Trust */}
      <section id="trust" className="scroll-mt-16 border-t-2 border-ink">
        <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-24">
          <div>
            <h2 className="max-w-[14ch] font-display text-4xl text-ink lg:text-5xl">Nothing leaves without you.</h2>
            <p className="mt-5 max-w-[40ch] text-lg text-ink-muted">Funders can spot a made-up number from across the room. So can you.</p>
            <Button asChild variant="secondary" className="mt-8">
              <Link href="/security">Read how we handle your data</Link>
            </Button>
          </div>
          <ul className="border-t border-rule text-base text-ink sm:text-lg">
            {trust.map((t) => (
              <li key={t} className="max-w-[60ch] border-b border-rule py-4">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-t-2 border-ink">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <h2 className="max-w-[20ch] font-display text-4xl text-ink lg:text-5xl">Priced for the organizations the big tools price out.</h2>
          <p className="mt-5 max-w-[60ch] text-lg text-ink-muted">A grant writer costs a few thousand dollars a month. The big databases start near three hundred. We start at free and stay cheap on purpose.</p>
          <div className="mt-12 border-t-2 border-ink">
            {pricingTiers.map((t) => (
              <div key={t.name} className="grid gap-4 border-b border-rule py-7 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:gap-8">
                <div>
                  <h3 className="font-display text-2xl text-ink">{t.name}</h3>
                  <p className="mt-1 font-display text-3xl text-ink tnum">
                    {t.price}
                    {t.period ? <span className="font-body text-sm font-normal text-ink-muted"> {t.period}</span> : null}
                  </p>
                </div>
                <div>
                  <p className="text-base font-semibold text-ink">{t.who}</p>
                  <p className="mt-1 max-w-[55ch] text-base text-ink-muted">{t.includes.join(". ")}.</p>
                  {t.note ? <p className="mt-1 max-w-[55ch] text-sm text-ink-muted">{t.note}</p> : null}
                </div>
                {t.cta ? (
                  <Button asChild variant={t.name === "Starter" ? "primary" : "secondary"}>
                    <Link href="/sign-up">{t.cta}</Link>
                  </Button>
                ) : (
                  <span className="text-sm text-ink-muted">Coming later</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-[60ch] text-base text-ink-muted">
            Details and plan questions are on the{" "}
            <Link href="/pricing" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-pink">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="questions" className="scroll-mt-16 border-t-2 border-ink">
        <div className="mx-auto max-w-[75rem] px-4 py-16 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-24">
          <h2 className="max-w-[16ch] font-display text-4xl text-ink lg:text-5xl">Questions a careful director asks first.</h2>
          <div className="mt-10 border-t border-rule lg:mt-0">
            {faq.map((f) => (
              <details key={f.q} className="group border-b border-rule py-5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-display text-xl text-ink [&::-webkit-details-marker]:hidden">
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

      {/* Closing */}
      <section className="border-t-2 border-ink" data-meadow="closing">
        <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <h2 className="max-w-[16ch] font-display text-5xl text-ink lg:text-6xl">Start with your website.</h2>
          <p className="mt-6 max-w-[44ch] text-lg text-ink-muted">Ten minutes to your first matches. Free, and nothing is sent without you.</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/sign-up">Find my first grants</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
