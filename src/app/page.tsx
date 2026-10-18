import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-nav";
import { ApproveSealsDemo, CalendarDemo, DraftFillsDemo, HeroInbox, IntroDemo, MatchArrivesDemo, QuestionsDemo, SourcesDemo } from "@/components/marketing/demos";
import { LanternGlyph, MarginNote, SealedLetter } from "@/components/brand/illustrations";
import { Painting, PaintingCredit } from "@/components/brand/painting";
import { picks } from "@/lib/art";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME}: your next grant is closer than it feels`,
  description: `${PRODUCT_NAME} finds grants you can actually win, writes the first draft from your own documents, and keeps the deadlines so you don't have to. You open one Inbox and say yes or no.`,
};

const stories = [
  { org: "Riverbend Youth Collective", place: "Dayton, Ohio", kind: "After-school and summer jobs for 214 teens", quote: "I answered four questions on a Tuesday and had a proposal I would have taken a week to write.", who: "Dana, executive director", result: "$52,000 won in 90 days" },
  { org: "Harvest Table Food Bank", place: "Lubbock, Texas", kind: "Groceries for 1,900 families a month", quote: "It found a hospital community benefit fund we had never heard of. We had been driving past the building for years.", who: "Luis, director", result: "First hospital grant, $40,000" },
  { org: "Las Hermanas Textile Cooperative", place: "Española, New Mexico", kind: "A weaving cooperative owned by 23 women", quote: "The draft used our own words from the annual report. It sounded like us, not like a grant.", who: "Rosa, cooperative president", result: "2 applications a month, up from 3 a year" },
  { org: "Pine Hollow Rural Clinic", place: "Marshall, North Carolina", kind: "Primary care for a county with no hospital", quote: "The calendar is the thing. Board review on the 13th, submit on the 18th, deadline on the 20th. Nobody stayed up.", who: "Teresa, clinic manager", result: "Zero missed deadlines in a year" },
];

const tiers = [
  { name: "Free", price: "$0", who: "Try it with your real profile", items: ["Profile and knowledge base", "5 matches a month", "1 drafted letter of inquiry"] },
  { name: "Starter", price: "$29", who: "Budgets under $250K", items: ["Unlimited matches", "3 full proposals a month", "Calendar and reminders", "Outreach drafts"], featured: true },
  { name: "Growth", price: "$79", who: "Budgets $250K to $1M", items: ["Unlimited proposals", "Warm introductions when they ship", "3 seats"] },
];

const faqs = [
  { q: "Will funders know an AI helped?", a: "Some funders ask you to say so, and we keep track of which ones and nudge you when it applies. Every draft comes from your own documents and gets your edits, so you're the author. We're the first-draft friend." },
  { q: "Can it invent a funder or a number?", a: "No, and we built it that way on purpose. Every funder comes from a real page we checked, with the link and the date. If a fact isn't in your documents, the draft leaves a marked gap and asks you instead of guessing." },
  { q: "Does it submit for me?", a: "Never. We draft, you read, you click submit on the funder's portal. Same with email: we write it, you send it from your own address. The last step is always yours." },
  { q: "What about our data?", a: "They stay in your workspace and nobody trains a model on them. If you ever want to leave, one click deletes everything. No phone call required." },
];

const Cta = ({ variant = "glow" as "glow" | "primary", size = "lg" as "lg" | "md" }) => (
  <Button asChild size={size} variant={variant}>
    <Link href="/sign-up">
      See your first matches <ArrowRight aria-hidden />
    </Link>
  </Button>
);

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-glow focus:px-3 focus:py-2 focus:text-glow-fg">
        Skip to content
      </a>

      {/* ---------- Hero: night, a painting, the real Inbox floating on it ---------- */}
      <section className="relative isolate overflow-hidden bg-night text-night-fg">
        <div className="absolute inset-x-0 top-0 -z-10 h-[44rem] sm:h-[56rem] lg:h-[64rem]">
          <Painting painting={picks.hero} priority grade="soft" focus="50% 8%" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-night" aria-hidden />
        </div>
        <SiteNav tone="paper" />
        <main id="main" className="mx-auto max-w-6xl px-4 pb-14 pt-28 sm:px-6 sm:pt-32 lg:pb-20 lg:pt-36">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-glow">For nonprofits with four staff and forty tabs open</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">Your next grant is closer than it feels.</h1>
            <p className="mt-5 max-w-xl text-lg text-night-fg/90">
              {PRODUCT_NAME} finds the funders you can actually win, writes the first draft from your own documents, and keeps the deadlines so you don&apos;t have to. You open one Inbox and say yes or no.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Cta />
              <span className="text-sm text-night-fg/80">About twenty minutes. No card. Nothing goes anywhere without you.</span>
            </div>
          </div>
          <div className="relative mt-16 lg:mt-20">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <p className="text-xs font-semibold text-night-fg/80">Your Inbox · Saturday</p>
              <MarginNote className="text-night-fg" arrow="none">the real thing, not a mockup</MarginNote>
            </div>
            <div className="mx-auto max-w-3xl">
              <HeroInbox />
            </div>
          </div>
        </main>
        <PaintingCredit painting={picks.hero} className="absolute bottom-3 right-4" />
      </section>

      {/* ---------- The night before: paper ---------- */}
      <section className="bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className="text-sm font-semibold text-accent">The night before</p>
              <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">You know this Sunday.</h2>
            </div>
            <ul className="flex flex-col gap-6 text-lg text-fg">
              <li className="relative pl-6">
                <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
                It&apos;s 9:40 pm. The deadline is Friday, 5 pm Eastern. Of course it is.
              </li>
              <li className="relative pl-6">
                <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
                You&apos;ve got forty tabs open. Three of those funders quietly stopped giving in 2023, and their websites never got the memo.
                <MarginNote className="mt-1 block" arrow="left">we check the page first</MarginNote>
              </li>
              <li className="relative pl-6">
                <LanternGlyph size={18} className="absolute left-0 top-1.5 text-fg-subtle" glow={false} />
                The proposal is good. You wrote it alone, again, somewhere between payroll and a parent on the phone.
              </li>
              <li className="mt-2 border-t border-border pt-6 text-base text-fg-muted">
                You shouldn&apos;t have to do this by yourself. {PRODUCT_NAME} walks the path with you and lights the next step. The work still gets your eyes. It just stops needing your nights.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- How it works: night, the product large ---------- */}
      <section id="how" className="bg-night text-night-fg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-glow">How it works</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Three things happen. You only have to do the last one.</h2>
          </div>
          <ol className="mt-14 flex flex-col gap-20">
            <Step n="1" title="A match arrives, with reasons" body="Every Monday we read each funder's own page, check it against your profile, and tell you in plain words why it fits. If you can't apply, you'll never see it. Your Monday has enough in it already.">
              <MatchArrivesDemo />
            </Step>
            <Step n="2" title="The first draft writes itself from your own numbers" body="We turn the guidelines into a checklist, then write every section from your annual report, your 990, and the proposals you've already written. Every claim links back to the page it came from, so you never have to wonder." flip>
              <DraftFillsDemo />
            </Step>
            <Step n="3" title="You read it. You approve. It seals." body="Edit anything, answer the few questions we couldn't, and approve. Anything you approve gets sealed and filed in your records. Nothing is submitted or sent until you do it yourself, and we mean that.">
              <ApproveSealsDemo />
            </Step>
          </ol>
          <div className="mt-20 flex flex-col items-center gap-3 text-center">
            <Cta />
            <p className="text-sm text-night-fg/75">Free to start. Your first matches in about twenty minutes.</p>
          </div>
        </div>
      </section>

      {/* ---------- Features: paper ---------- */}
      <section className="bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">What is in the lantern</p>
            <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">The small things that matter at 9:40 pm.</h2>
          </div>
          <div className="mt-12 grid gap-12 md:grid-cols-2 lg:gap-x-12">
            <Feature title="Every number has a receipt" body="Click any number in a draft and read the exact passage it came from, page number included. Anything older than a year taps you on the shoulder before it goes anywhere.">
              <SourcesDemo />
            </Feature>
            <Feature title="When it does not know, it asks" body="When we can't find a fact, we leave a question in the margin instead of a plausible guess. Answer it once and it's a cited fact in every draft from then on.">
              <QuestionsDemo />
            </Feature>
            <Feature title="Deadlines planned backward" body="Draft due, budget sign-off, board review, submit. Each one lands on your calendar with a reminder, so the deadline is the last thing that happens instead of the first thing you notice.">
              <CalendarDemo />
            </Feature>
            <Feature title="Warm introductions, coming next" body="Your board already knows people. Soon we'll spot the overlap with a funder's board and draft the intro for your board member to send. Public sources only, and they hit send, not us.">
              <IntroDemo />
            </Feature>
          </div>
        </div>
      </section>

      {/* ---------- Trust: a painting, lit windows ---------- */}
      <section id="trust" className="relative isolate overflow-hidden bg-night text-night-fg">
        <Painting painting={picks.trust} grade="soft" className="-z-10" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-32">
          <div>
            <p className="text-sm font-semibold text-glow">Trust</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Nothing leaves without you.</h2>
            <p className="mt-4 max-w-xl text-lg text-night-fg/90">Funders can spot a made-up number from across the room. So can you. We built {PRODUCT_NAME} so neither of you ever has to.</p>
            <ul className="mt-8 flex flex-col gap-4 text-base">
              {[
                "Every funder comes from a real page we checked, with the date we checked it. Nothing gets named from memory.",
                "Every claim in a proposal links to one of your own documents. A missing fact becomes a question for you, never a guess.",
                "We never send, post, or submit anything. You copy the email. You click submit on the portal. That's the deal.",
                "The activity log shows every step we took and every source we read. Nothing happens off stage.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-1.5 size-4 shrink-0 text-glow" aria-hidden />
                  <span className="text-night-fg/95">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-night/80 p-6 ring-1 ring-night-fg/15 backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              <SealedLetter size={72} className="text-night-fg" />
              <div>
                <p className="font-display text-xl">The seal means you read it.</p>
                <p className="text-sm text-night-muted">Everything you approve is sealed and filed, with your name and the time. Your records, your word.</p>
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
        <PaintingCredit painting={picks.trust} className="absolute bottom-3 right-4" />
      </section>

      {/* ---------- Stories: paper, text-led ---------- */}
      <section id="stories" className="bg-bg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">Stories</p>
              <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Four organizations that got their weekends back.</h2>
            </div>
            <Badge variant="outline">Illustrative stories for the demo</Badge>
          </div>
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {stories.map((s) => (
              <li key={s.org} className="flex flex-col rounded-2xl border border-border bg-surface p-7 sm:p-8">
                <blockquote className="font-display text-2xl leading-snug text-fg sm:text-[1.75rem] sm:leading-[1.3]">“{s.quote}”</blockquote>
                <div className="mt-6 flex flex-1 flex-col justify-end">
                  <p className="text-sm font-semibold text-fg">{s.who}</p>
                  <p className="text-sm text-fg-muted">
                    {s.org} · {s.place}
                  </p>
                  <p className="text-sm text-fg-subtle">{s.kind}</p>
                  <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success-soft-fg">
                    <Check className="size-3.5" aria-hidden /> {s.result}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Pricing: night ---------- */}
      <section id="pricing" className="bg-night text-night-fg">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-glow">Pricing</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Priced for the organizations the big tools price out.</h2>
            <p className="mt-3 text-lg text-night-fg/85">A grant writer runs $2,000 a month. The big databases start at $299. We start at free and stay cheap on purpose, because we know what your budget looks like.</p>
          </div>
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {tiers.map((t) => (
              <li key={t.name} className={`relative flex flex-col rounded-2xl p-6 ring-1 ${t.featured ? "bg-night-raised ring-glow" : "bg-night-raised/60 ring-night-border"}`}>
                {t.featured ? (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-glow px-3 py-1 text-xs font-semibold text-glow-fg">
                    <LanternGlyph size={12} glow={false} /> Most chosen
                  </span>
                ) : null}
                <h3 className="font-display text-2xl">{t.name}</h3>
                <p className="mt-1 text-sm text-night-muted">{t.who}</p>
                <p className="mt-4 font-display text-4xl">
                  {t.price}
                  <span className="font-sans text-base text-night-muted"> /month</span>
                </p>
                <ul className="mt-5 flex flex-1 flex-col gap-2 text-base text-night-fg/90">
                  {t.items.map((i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="mt-1.5 size-4 shrink-0 text-glow" aria-hidden /> {i}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={t.featured ? "glow" : "ghost"} className={`mt-6 ${t.featured ? "" : "ring-1 ring-night-fg/25 text-night-fg hover:bg-night-hover hover:text-night-fg"}`}>
                  <Link href="/sign-up">Start with {t.name}</Link>
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-night-fg/80">
            If $29 is hard this month, just write to us. We haven&apos;t said no yet. <MarginNote arrow="none" className="ml-1 text-glow">really</MarginNote>
          </p>
        </div>
      </section>

      {/* ---------- FAQ: paper ---------- */}
      <section id="faq" className="bg-bg">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="font-display text-3xl text-fg sm:text-4xl">Things executive directors ask us, usually at 9:40 pm.</h2>
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

      {/* ---------- Closing: dawn ---------- */}
      <section className="relative isolate overflow-hidden bg-night text-night-fg">
        <Painting painting={picks.closing} focus="50% 10%" grade="soft" shade="left" className="-z-10" />
        <div className="mx-auto flex max-w-6xl flex-col items-start px-4 py-28 sm:px-6 lg:py-40">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl sm:text-5xl">The path is lit. Take one step.</h2>
            <p className="mt-4 text-lg text-night-fg/90">Paste your website. Upload one document. See three grants you could win this month. We&apos;ll be right here.</p>
            <div className="mt-8">
              <Cta />
            </div>
            <p className="mt-4 text-sm text-night-fg/80">About twenty minutes. Free. You keep your nights.</p>
          </div>
        </div>
        <PaintingCredit painting={picks.closing} className="absolute bottom-3 right-4" />
      </section>
      <SiteFooter />
    </div>
  );
}

function Step({ n, title, body, children, flip }: { n: string; title: string; body: string; children: React.ReactNode; flip?: boolean }) {
  return (
    <li className={`grid items-center gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2 lg:grid-cols-[3fr_2fr]" : ""}`}>
      <div>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-glow font-display text-lg text-glow-fg" aria-hidden>
          {n}
        </span>
        <h3 className="mt-4 font-display text-2xl sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-base text-night-fg/85">{body}</p>
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
