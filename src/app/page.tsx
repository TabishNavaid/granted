import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/marketing/site-nav";
import { DraftSheet, HeroInbox, MatchSheet, StampSheet } from "@/components/marketing/demos";
import { Plate } from "@/components/brand/duotone";
import { plates } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: ${PRODUCT_TAGLINE.replace(/\.$/, "").toLowerCase()}`,
  description: `${PRODUCT_NAME} finds the funders you can win, drafts the proposal from your own documents, and keeps every deadline. You read it, you approve it, and nothing moves without you.`,
};

const stories = [
  { org: "Riverbend Youth Collective", place: "Dayton, Ohio", kind: "After-school and summer jobs for 214 teens", quote: "I answered four questions on a Tuesday and had a proposal I would have taken a week to write.", who: "Dana, executive director", result: "$52,000 won in 90 days" },
  { org: "Harvest Table Food Bank", place: "Lubbock, Texas", kind: "Groceries for 1,900 families a month", quote: "It found a hospital community benefit fund we had never heard of. We had been driving past the building for years.", who: "Luis, director", result: "First hospital grant, $40,000" },
  { org: "Las Hermanas Textile Cooperative", place: "Española, New Mexico", kind: "A weaving cooperative owned by 23 women", quote: "The draft used our own words from the annual report. It sounded like us, not like a grant.", who: "Rosa, cooperative president", result: "2 applications a month, up from 3 a year" },
  { org: "Pine Hollow Rural Clinic", place: "Marshall, North Carolina", kind: "Primary care for a county with no hospital", quote: "The calendar is the thing. Board review on the 13th, submit on the 18th, deadline on the 20th. Nobody stayed up.", who: "Teresa, clinic manager", result: "No missed deadlines in a year" },
];

const tiers = [
  { name: "Free", price: "$0", who: "Try it with your real profile.", items: ["Profile and knowledge base", "5 matches a month", "1 drafted letter of inquiry"] },
  { name: "Starter", price: "$29", who: "Budgets under $250,000.", items: ["Unlimited matches", "3 full proposals a month", "Calendar and reminders", "Outreach drafts"], featured: true },
  { name: "Growth", price: "$79", who: "Budgets from $250,000 to $1 million.", items: ["Unlimited proposals", "Warm introductions when they ship", "3 seats"] },
];

const faqs = [
  { q: "Will funders know an AI helped?", a: "Some funders ask you to say so. We keep track of which ones and tell you when it applies. Every draft comes from your own documents and gets your edits, so you are the author." },
  { q: "Can it invent a funder or a number?", a: "No. Every funder comes from a real page we checked, with the link and the date. If a fact is not in your documents, the draft leaves a marked gap and asks you instead of guessing." },
  { q: "Does it submit for me?", a: "Never. We draft, you read, you click submit on the funder's portal. Same with email: we write it, you send it from your own address." },
  { q: "What about our data?", a: "It stays in your workspace and nobody trains a model on it. If you want to leave, one click deletes everything." },
];

const trust = [
  "Every funder comes from a real page we checked, with the date we checked it. Nothing is named from memory.",
  "Every claim in a proposal links to one of your own documents. A missing fact becomes a question for you, never a guess.",
  "We never send, post, or submit anything. You copy the email. You click submit on the portal.",
  "The activity log shows every step we took and every source we read.",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-yellow focus:px-3 focus:py-2 focus:text-on-yellow">
        Skip to content
      </a>
      <SiteNav />

      {/* ---------- Hero: the headline is the poster; the Inbox is the real thing ---------- */}
      <main id="main">
        <section className="mx-auto max-w-[75rem] px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-10 lg:pb-28 lg:pt-24">
          <h1 className="max-w-[11ch] font-display text-display tracking-[-0.03em] text-ink">{PRODUCT_TAGLINE}</h1>
          <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <p className="max-w-[52ch] text-lg text-ink sm:text-xl">
              {PRODUCT_NAME} finds the funders you can win, drafts the proposal from your own documents, and keeps every deadline. You read it. You approve it. Nothing moves without you.
            </p>
            <div className="flex flex-col items-start gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">See your first matches</Link>
              </Button>
              <p className="text-sm text-ink-muted">Free. About twenty minutes.</p>
            </div>
          </div>

          <div className="mt-16 max-w-[56rem] lg:mt-24">
            <HeroInbox />
          </div>
        </section>

        {/* ---------- The night before ---------- */}
        <section className="border-t-2 border-ink">
          <div className="mx-auto grid max-w-[75rem] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-28">
            <h2 className="font-display text-4xl text-ink lg:text-5xl">You know this Sunday.</h2>
            <div>
              <ul className="border-t border-rule text-lg text-ink sm:text-xl">
                <li className="border-b border-rule py-5">It is 9:40 pm. The deadline is Friday at 5 pm Eastern.</li>
                <li className="border-b border-rule py-5">Forty tabs are open. Three of those funders stopped giving in 2023 and their websites never got the memo.</li>
                <li className="border-b border-rule py-5">The proposal is good. You wrote it alone, again, between payroll and a parent on the phone.</li>
              </ul>
              <p className="mt-8 max-w-[52ch] text-lg text-ink-muted">The work still gets your eyes. It stops needing your nights.</p>
            </div>
          </div>
        </section>

        {/* ---------- How it works: a real sequence, so real numbers ---------- */}
        <section id="how" className="border-t-2 border-ink scroll-mt-16">
          <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <h2 className="max-w-[18ch] font-display text-4xl text-ink lg:text-5xl">Three things happen. You do the last one.</h2>
            <ol className="mt-16 flex flex-col gap-20 lg:gap-28">
              <Step n="1" title="A funder arrives with reasons" body="Every Monday we read each funder's own page, check it against your profile, and say in plain words why it fits. If you cannot apply, you never see it.">
                <MatchSheet />
              </Step>
              <Step n="2" title="The draft writes itself from your own numbers" body="We turn the guidelines into a checklist, then write every section from your annual report, your 990, and the proposals you have already written. Every number carries a footnote to the page it came from." flip>
                <DraftSheet />
              </Step>
              <Step n="3" title="You read it. You stamp it." body="Edit anything, answer the questions it could not, and approve. The stamp goes on, the item is filed, and nothing is submitted or sent until you do it yourself.">
                <StampSheet />
              </Step>
            </ol>
            <div className="mt-20 flex flex-col items-start gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">See your first matches</Link>
              </Button>
              <p className="text-sm text-ink-muted">Free to start. Your first matches in about twenty minutes.</p>
            </div>
          </div>
        </section>

        {/* ---------- Trust ---------- */}
        <section id="trust" className="border-t-2 border-ink scroll-mt-16">
          <div className="mx-auto grid max-w-[75rem] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-20 lg:px-10 lg:py-28">
            <div>
              <h2 className="font-display text-4xl text-ink lg:text-5xl">Nothing leaves without you.</h2>
              <p className="mt-5 max-w-[52ch] text-lg text-ink-muted">Funders can spot a made-up number from across the room. So can you.</p>
              <ul className="mt-10 border-t border-rule text-base text-ink sm:text-lg">
                {trust.map((t) => (
                  <li key={t} className="max-w-[60ch] border-b border-rule py-4">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <Plate image={plates.trust} inks="blue-pink" aspect="4 / 5" sizes="(min-width: 1024px) 40vw, 100vw" className="lg:mt-3" />
          </div>
        </section>

        {/* ---------- Stories: a bulletin board ---------- */}
        <section id="stories" className="border-t-2 border-ink">
          <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <h2 className="max-w-[18ch] font-display text-4xl text-ink lg:text-5xl">Four organizations that got their weekends back.</h2>
            <ul className="mt-12 border-t border-rule">
              {stories.map((s) => (
                <li key={s.org} className="grid gap-5 border-b border-rule py-8 lg:grid-cols-[1fr_20rem] lg:gap-16">
                  <blockquote className="max-w-[40ch] text-xl leading-snug text-ink sm:text-2xl">“{s.quote}”</blockquote>
                  <div className="text-base">
                    <p className="font-semibold text-ink">{s.who}</p>
                    <p className="text-ink-muted">{s.org}</p>
                    <p className="text-ink-muted">{s.place}</p>
                    <p className="text-ink-muted">{s.kind}</p>
                    <p className="mt-3 font-display text-xl text-ink">{s.result}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-muted">Illustrative stories for the demo.</p>
          </div>
        </section>

        {/* ---------- Pricing: a rate card ---------- */}
        <section id="pricing" className="border-t-2 border-ink scroll-mt-16">
          <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <h2 className="max-w-[20ch] font-display text-4xl text-ink lg:text-5xl">Priced for the organizations the big tools price out.</h2>
            <p className="mt-5 max-w-[60ch] text-lg text-ink-muted">A grant writer runs $2,000 a month. The big databases start at $299. We start at free and stay cheap on purpose.</p>
            <div className="mt-12 border-t-2 border-ink">
              {tiers.map((t) => (
                <div key={t.name} className="grid gap-4 border-b border-rule py-7 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-8">
                  <div>
                    <h3 className="font-display text-2xl text-ink">{t.name}</h3>
                    <p className="mt-1 font-display text-3xl text-ink tnum">
                      {t.price}
                      <span className="font-body text-sm font-normal text-ink-muted"> a month</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-ink">{t.who}</p>
                    <p className="mt-1 max-w-[55ch] text-base text-ink-muted">{t.items.join(". ")}.</p>
                  </div>
                  <Button asChild variant={t.featured ? "primary" : "secondary"}>
                    <Link href="/sign-up">Start with {t.name}</Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-[60ch] text-base text-ink-muted">If $29 is hard this month, write to us. We have not said no yet.</p>
          </div>
        </section>

        {/* ---------- Questions ---------- */}
        <section id="questions" className="border-t-2 border-ink scroll-mt-16">
          <div className="mx-auto max-w-[75rem] px-4 py-20 sm:px-6 lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-10 lg:py-28">
            <h2 className="max-w-[16ch] font-display text-4xl text-ink lg:text-5xl">Things executive directors ask us, usually at 9:40 pm.</h2>
            <div className="mt-10 border-t border-rule lg:mt-0">
              {faqs.map((f) => (
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

        {/* ---------- Closing ---------- */}
        <section className="border-t-2 border-ink">
          <div className="mx-auto grid max-w-[75rem] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-20 lg:px-10 lg:py-28">
            <Plate image={plates.closing} inks="blue-yellow" aspect="4 / 5" sizes="(min-width: 1024px) 40vw, 100vw" />
            <div>
              <h2 className="max-w-[14ch] font-display text-5xl text-ink lg:text-6xl">Start with your website and one document.</h2>
              <p className="mt-6 max-w-[44ch] text-lg text-ink-muted">See three grants you could win this month.</p>
              <div className="mt-8">
                <Button asChild size="lg">
                  <Link href="/sign-up">See your first matches</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Step({ n, title, body, children, flip }: { n: string; title: string; body: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <li className={`grid items-start gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2 lg:grid-cols-[3fr_2fr]" : ""}`}>
      <div>
        <span className="font-display text-6xl leading-none text-ink tnum" aria-hidden>
          {n}
        </span>
        <h3 className="mt-5 max-w-[20ch] font-display text-3xl text-ink">{title}</h3>
        <p className="mt-4 max-w-[48ch] text-lg text-ink-muted">{body}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
