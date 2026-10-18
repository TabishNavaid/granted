import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-nav";
import { ApproveSealsDemo, CalendarDemo, DraftFillsDemo, HeroInbox, IntroDemo, LiveDot, MatchArrivesDemo, QuestionsDemo, SourcesDemo } from "@/components/marketing/demos";
import { DawnScene, HorizonRule, LanternGlyph, MarginNote, PhotoSlot, SealedLetter } from "@/components/brand/illustrations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: your next grant is closer than it feels`,
  description: `${PRODUCT_NAME} finds the grants you can win, drafts the proposals from your own documents, and keeps the deadlines. You open one Inbox and approve.`,
};

const stories = [
  { org: "Riverbend Youth Collective", place: "Dayton, Ohio", kind: "After-school and summer jobs for 214 teens", quote: "I answered four questions on a Tuesday and had a proposal I would have taken a week to write.", who: "Dana, executive director", result: "$52,000 in 90 days" },
  { org: "Harvest Table Food Bank", place: "Lubbock, Texas", kind: "Groceries for 1,900 families a month", quote: "It found a hospital community benefit fund we had never heard of. We had been driving past the building for years.", who: "Luis, director", result: "First hospital grant" },
  { org: "Las Hermanas Textile Cooperative", place: "Española, New Mexico", kind: "A weaving cooperative owned by 23 women", quote: "The draft used our own words from the annual report. It sounded like us, not like a grant.", who: "Rosa, cooperative president", result: "2 applications a month, up from 3 a year" },
  { org: "Pine Hollow Rural Clinic", place: "Marshall, North Carolina", kind: "Primary care for a county with no hospital", quote: "The calendar is the thing. Board review on the 13th, submit on the 18th, deadline on the 20th. Nobody stayed up.", who: "Teresa, clinic manager", result: "Zero missed deadlines" },
];

const tiers = [
  { name: "Free", price: "$0", who: "Try it with your real profile", items: ["Profile and knowledge base", "5 matches a month", "1 drafted letter of inquiry"] },
  { name: "Starter", price: "$29", who: "Budgets under $250K", items: ["Unlimited matches", "3 full proposals a month", "Calendar and reminders", "Outreach drafts"], featured: true },
  { name: "Growth", price: "$79", who: "Budgets $250K to $1M", items: ["Unlimited proposals", "Warm introductions when they ship", "3 seats"] },
];

const faqs = [
  { q: "Will funders know an AI helped?", a: "Some ask for disclosure, and we track those policies and tell you when one applies. Every draft is written from your own documents and edited by you, so you are the author." },
  { q: "Can it invent a funder or a number?", a: "No. Funders come only from verified sources with a link and a last-checked date. If a fact is not in your documents, the draft shows a placeholder and asks you." },
  { q: "Does it submit for me?", a: "Never. It drafts, you review, you submit on the funder's portal. Same for email: nothing is sent from your account." },
  { q: "What about our data?", a: "Your documents are private to your workspace and never used to train models. Delete everything in one click, any time." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-glow focus:px-3 focus:py-2 focus:text-glow-fg">
        Skip to content
      </a>

      {/* ---------- Hero: the real Inbox inside the dawn ---------- */}
      <section className="relative isolate overflow-hidden bg-[#2a2350] text-night-fg">
        <div className="absolute inset-x-0 top-0 -z-10 h-[46rem] sm:h-[64rem] lg:h-[72rem]">
          <DawnScene anchor="top" />
        </div>
        <SiteNav tone="paper" />
        <main id="main" className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 sm:pt-32 lg:pt-36">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-glow">For nonprofits with four staff and forty tabs open</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">Your next grant is closer than it feels.</h1>
            <p className="mt-5 max-w-xl text-lg text-night-fg/85">
              {PRODUCT_NAME} finds the funders you can win, writes the first draft from your own documents, and keeps the deadlines. You open one Inbox and approve.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg" variant="glow">
                <Link href="/sign-up">
                  See your first matches <ArrowRight aria-hidden />
                </Link>
              </Button>
              <span className="text-sm text-night-fg/75">Twenty minutes. No card. Nothing sent without you.</span>
            </div>
          </div>
          <div className="relative mt-14 lg:mt-16">
            <MarginNote className="mb-2 text-night-fg lg:absolute lg:-top-9 lg:right-6" arrow="none">
              the real thing, not a mockup
            </MarginNote>
            <div className="mx-auto max-w-3xl rounded-2xl border border-night-fg/15 bg-bg/85 p-2 shadow-lg backdrop-blur-sm sm:p-3">
              <div className="rounded-xl bg-bg p-3 text-fg sm:p-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-fg-subtle">Your Inbox · Saturday</p>
                  <LiveDot />
                </div>
                <HeroInbox />
              </div>
            </div>
          </div>
        </main>
      </section>

      {/* ---------- The night before ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-accent">The night before</p>
            <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">You know this Sunday.</h2>
          </div>
          <ul className="flex flex-col gap-6 text-lg text-fg">
            <li className="relative pl-6">
              <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
              It is 9:40 pm. The deadline is Friday, 5 pm Eastern. Of course it is.
            </li>
            <li className="relative pl-6">
              <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
              Forty tabs are open. Three of those funders stopped giving in 2023 and their websites never mentioned it.
              <MarginNote className="mt-1 block" arrow="left">we check the page first</MarginNote>
            </li>
            <li className="relative pl-6">
              <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
              The proposal is good. You wrote it alone, again, between payroll and a parent on the phone.
            </li>
            <li className="mt-2 border-t border-border pt-6 text-base text-fg-muted">
              You should not have to do this by yourself. {PRODUCT_NAME} walks the path with you and lights the next step. The work still gets your eyes. It just stops needing your nights.
            </li>
          </ul>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">How it works</p>
            <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Three things happen. You only do the last one.</h2>
          </div>
          <ol className="mt-12 flex flex-col gap-16">
            <Step n="1" title="A match arrives, with reasons" body="Every Monday the Discovery agent reads the funder's own page, checks your eligibility against your profile, and explains the fit in plain words. Anything you cannot apply for never reaches you.">
              <MatchArrivesDemo />
            </Step>
            <Step n="2" title="The first draft writes itself from your own numbers" body="The Proposal agent turns the guidelines into a checklist, then drafts every section from your annual report, your 990, and your past proposals. Each claim links to the page it came from." flip>
              <DraftFillsDemo />
            </Step>
            <Step n="3" title="You read it. You approve. It seals." body="Edit in place, answer the questions it could not, and approve. Approved drafts become sealed letters in your records. Nothing is submitted or sent until you do it yourself.">
              <ApproveSealsDemo />
            </Step>
          </ol>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">What is in the lantern</p>
          <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Small things that make the difference at 9:40 pm.</h2>
        </div>
        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:gap-x-14">
          <Feature title="Every number has a receipt" body="Click any figure in a draft and read the exact passage it came from, with the page number. Facts older than a year ask to be confirmed before they go anywhere.">
            <SourcesDemo />
          </Feature>
          <Feature title="When it does not know, it asks" body="A missing fact becomes a question in the margin, never a plausible guess. Your answer becomes a cited fact for every draft after this one.">
            <QuestionsDemo />
          </Feature>
          <Feature title="Deadlines planned backward" body="Draft due, budget sign-off, board review, submit. Each one lands on your calendar with a reminder, so the deadline is the last thing that happens, not the first.">
            <CalendarDemo />
          </Feature>
          <Feature title="Warm introductions, coming next" body="Your board already knows people. Soon the Connections agent will find the overlap with a funder's board and draft the intro for your board member to send.">
            <IntroDemo />
          </Feature>
        </div>
      </section>

      {/* ---------- Trust ---------- */}
      <section id="trust" className="relative isolate overflow-hidden bg-night text-night-fg">
        <div className="absolute inset-0 -z-10 opacity-60">
          <DawnScene lanterns={false} />
        </div>
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
          <div>
            <p className="text-sm font-semibold text-glow">Trust</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Nothing leaves without you.</h2>
            <p className="mt-4 max-w-xl text-lg text-night-fg/85">Funders can spot a made-up number from across the room. So can you. {PRODUCT_NAME} is built so that neither of you ever has to.</p>
            <ul className="mt-8 flex flex-col gap-4 text-base">
              {[
                "Funders come only from a verified page, with the date we last checked it. The model never names one from memory.",
                "Every claim in a proposal links to your own document. A missing fact becomes a question, not a guess.",
                "Nothing is sent, posted, or submitted by the agents. You copy the email. You click submit on the portal.",
                "The activity log shows every tool each agent called and every source it read. Nothing happens off stage.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-1.5 size-4 shrink-0 text-glow" aria-hidden />
                  <span className="text-night-fg/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-night-fg/15 bg-night-raised/70 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <SealedLetter size={72} className="text-night-fg" />
              <div>
                <p className="font-display text-xl">The seal means you read it.</p>
                <p className="text-sm text-night-muted">Approved items are sealed and filed, with your name and the time.</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-night-fg/15 pt-6 text-sm">
              <div>
                <dt className="text-night-muted">Invented funders</dt>
                <dd className="font-display text-3xl">0</dd>
              </div>
              <div>
                <dt className="text-night-muted">Emails sent for you</dt>
                <dd className="font-display text-3xl">0</dd>
              </div>
              <div>
                <dt className="text-night-muted">Claims without a source</dt>
                <dd className="font-display text-3xl">0</dd>
              </div>
              <div>
                <dt className="text-night-muted">Training on your data</dt>
                <dd className="font-display text-3xl">Never</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- Stories ---------- */}
      <section id="stories" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">Stories</p>
            <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Four organizations that stopped working weekends.</h2>
          </div>
          <Badge variant="outline">Illustrative stories for the demo</Badge>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-2">
          {stories.map((s, i) => (
            <li key={s.org} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
              <PhotoSlot className="h-40 rounded-none border-0 border-b border-dashed" label={i % 2 ? "Photo slot: the people, not the building" : "Photo slot: your community, when you have one"} />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-semibold text-fg-subtle">
                  {s.place} · {s.kind}
                </p>
                <blockquote className="mt-3 font-display text-xl leading-snug text-fg">“{s.quote}”</blockquote>
                <p className="mt-3 text-sm text-fg-muted">{s.who}, {s.org}</p>
                <p className="mt-auto pt-5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success-soft-fg">
                    <Check className="size-3.5" aria-hidden /> {s.result}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <HorizonRule className="mx-auto max-w-6xl px-4 sm:px-6" />

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-accent">Pricing</p>
          <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Priced for the organizations the big tools price out.</h2>
          <p className="mt-3 text-lg text-fg-muted">A grant writer costs $2,000 a month. The big databases start at $299. We start at free, and stay cheap on purpose.</p>
        </div>
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <li key={t.name} className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${t.featured ? "border-glow shadow-md ring-2 ring-glow/40" : "border-border"}`}>
              {t.featured ? (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-glow px-3 py-1 text-xs font-semibold text-glow-fg">
                  <LanternGlyph size={12} glow={false} /> Most chosen
                </span>
              ) : null}
              <h3 className="font-display text-2xl text-fg">{t.name}</h3>
              <p className="mt-1 text-sm text-fg-subtle">{t.who}</p>
              <p className="mt-4 font-display text-4xl text-fg">
                {t.price}
                <span className="font-sans text-base text-fg-subtle"> /month</span>
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-base text-fg-muted">
                {t.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-1.5 size-4 shrink-0 text-success" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
              <Button asChild variant={t.featured ? "primary" : "secondary"} className="mt-6">
                <Link href="/sign-up">Start with {t.name}</Link>
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-fg-muted">
          If $29 is hard this month, write to us. We have never said no. <MarginNote arrow="none" className="ml-1">really</MarginNote>
        </p>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="font-display text-3xl text-fg sm:text-4xl">Questions executive directors ask us.</h2>
          <div className="mt-8 divide-y divide-border">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-fg [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-fg-subtle transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-base text-fg-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Closing ---------- */}
      <section className="relative isolate overflow-hidden bg-night text-night-fg">
        <div className="absolute inset-0 -z-10">
          <DawnScene />
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:py-32">
          <LanternGlyph size={56} className="text-night-fg" />
          <h2 className="mt-6 font-display text-4xl sm:text-5xl">The path is lit. Take one step.</h2>
          <p className="mt-4 max-w-md text-lg text-night-fg/85">Paste your website. Upload one document. See three grants you could win this month.</p>
          <Button asChild size="lg" variant="glow" className="mt-8">
            <Link href="/sign-up">
              See your first matches <ArrowRight aria-hidden />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-night-fg/70">Twenty minutes. Free. You keep your nights.</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Step({ n, title, body, children, flip }: { n: string; title: string; body: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <li className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-night font-display text-lg text-night-fg" aria-hidden>
          {n}
        </span>
        <h3 className="mt-4 font-display text-2xl text-fg sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-base text-fg-muted">{body}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

function Feature({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">{children}</div>
      <div>
        <h3 className="font-display text-2xl text-fg">{title}</h3>
        <p className="mt-2 max-w-md text-base text-fg-muted">{body}</p>
      </div>
    </div>
  );
}
