import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Compass, FileText, Inbox, Mail, ShieldCheck, Sparkle } from "lucide-react";
import { SiteFooter, SiteNav } from "@/components/marketing/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FitScore } from "@/components/app/fit-score";
import { VerifiedSource } from "@/components/app/citation-chip";

export const metadata: Metadata = {
  title: "Granted: a funding team for small nonprofits",
  description: "Every month, your matched grants arrive drafted, scheduled, and ready to review. You just approve.",
};

const steps = [
  { n: "1", title: "Tell us who you are", body: "Paste your website and EIN, upload an annual report or an old proposal. In about twenty minutes, your profile and facts are ready, each with its source." },
  { n: "2", title: "Approve a plan each month", body: "On the 1st, a short plan lands in your Inbox: two to five grants worth your time, with the effort and expected award for each. Keep, skip, or swap." },
  { n: "3", title: "Review, then submit", body: "Drafts, emails, and milestones arrive ready to review. You edit in place, export, and submit on the funder's portal. Nothing goes out without you." },
];

const agents = [
  { icon: Compass, name: "Discovery", body: "Scans foundations, corporate programs, and federal sources every week. Filters out anything you cannot apply for before you see it." },
  { icon: FileText, name: "Proposal", body: "Turns guidelines into a checklist, then drafts every section from your own documents. Unknown facts become questions, never guesses." },
  { icon: Mail, name: "Outreach", body: "Writes the email to the program officer, the cover note, and the thank-you. You send them from your own address." },
  { icon: CalendarDays, name: "Calendar", body: "Plans backward from each deadline: draft due, budget sign-off, board review, submit. Reminders by email." },
  { icon: Sparkle, name: "Planner", body: "Picks what to apply for each month based on fit, deadlines, and the hours you actually have." },
  { icon: Inbox, name: "Your Inbox", body: "One place where everything waits for approve, edit, or reject. Open it when you have twenty minutes." },
];

const tiers = [
  { name: "Free", price: "$0", who: "Try it with your real profile", items: ["Profile and knowledge base", "5 matches a month", "1 drafted letter of inquiry"] },
  { name: "Starter", price: "$29", who: "Budgets under $250K", items: ["Unlimited matches", "3 full proposals a month", "Calendar and reminders", "Outreach drafts"], featured: true },
  { name: "Growth", price: "$79", who: "Budgets $250K to $1M", items: ["Unlimited proposals", "Connections and social agents when they ship", "3 seats"] },
];

const faqs = [
  { q: "Will funders know an AI helped?", a: "Some funders ask for disclosure, and we track those policies and tell you when one applies. Every draft is written from your own documents and edited by you, so you are the author." },
  { q: "Can it invent a funder or a number?", a: "No. Funders come only from verified sources with a link and a last-checked date. If a fact is not in your documents, the draft shows a placeholder and asks you." },
  { q: "Does it submit applications for me?", a: "Never. It drafts, you review, you submit on the funder's portal. The same goes for email: nothing is sent from your account." },
  { q: "What about our data?", a: "Your documents are private to your workspace and are not used to train models. You can delete everything at any time." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-24 lg:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-accent">For nonprofits with budgets under $500K</p>
              <h1 className="mt-3 font-display text-4xl leading-[1.05] text-fg sm:text-5xl lg:text-6xl">
                Every month, your matched grants arrive drafted, scheduled, and ready to review.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-fg-muted">
                Granted is a done-for-you funding team. Agents find the right grants, write the proposals from your own documents, draft the emails, and build the calendar. You open one Inbox and approve.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    Start free <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted">
                {["Nothing is sent without you", "Every fact shows its source", "First matches in 20 minutes"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroInbox />
          </div>
        </section>

        <section id="how" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="font-display text-3xl text-fg sm:text-4xl">Your job shrinks to reviewing.</h2>
            <p className="mt-3 max-w-2xl text-lg text-fg-muted">Under two hours of your time per submitted application. Here is where those hours go.</p>
            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="relative pl-14">
                  <span className="absolute left-0 top-0 inline-flex size-10 items-center justify-center rounded-full bg-accent-soft font-display text-lg text-accent-soft-fg" aria-hidden>
                    {s.n}
                  </span>
                  <h3 className="font-display text-xl text-fg">{s.title}</h3>
                  <p className="mt-2 text-base text-fg-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="agents-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="agents-title" className="font-display text-3xl text-fg sm:text-4xl">Six agents, one Inbox.</h2>
          <p className="mt-3 max-w-2xl text-lg text-fg-muted">Each one does a job a development director would do. None of them acts without your approval.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <li key={a.name} className="rounded-lg border border-border bg-surface p-6">
                <a.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-4 font-display text-xl text-fg">{a.name}</h3>
                <p className="mt-2 text-base text-fg-muted">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="trust" className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                <ShieldCheck className="size-4" aria-hidden /> Verified by default
              </p>
              <h2 className="mt-3 font-display text-3xl text-fg sm:text-4xl">Trust is the whole product.</h2>
              <p className="mt-4 text-lg text-fg-muted">
                Funders can spot a made-up number. So every funder, deadline, and amount links to the page it came from, with the date we last checked. Every claim in a proposal links to the document in your own files that supports it.
              </p>
              <ul className="mt-6 flex flex-col gap-3 text-base text-fg">
                {["No invented funders. Opportunities come only from a database or a fetched page.", "Gaps become questions. A missing fact shows a placeholder and asks you.", "Human in the loop. Nothing is sent, posted, or submitted without you.", "Full activity log. See what each agent did and the sources it used."].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <TrustCard />
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="font-display text-3xl text-fg sm:text-4xl">Priced for the bottom of the market.</h2>
          <p className="mt-3 max-w-2xl text-lg text-fg-muted">A grant writer costs $2,000 a month. The big databases start at $299. We start at free.</p>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {tiers.map((t) => (
              <li key={t.name} className={`flex flex-col rounded-lg border bg-surface p-6 ${t.featured ? "border-accent shadow-md ring-1 ring-accent" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl text-fg">{t.name}</h3>
                  {t.featured ? <Badge variant="accent">Most chosen</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-fg-subtle">{t.who}</p>
                <p className="mt-4 font-display text-4xl text-fg">
                  {t.price}
                  <span className="text-base text-fg-subtle"> /month</span>
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
          <p className="mt-4 text-sm text-fg-subtle">Prices are placeholders while we test with early users.</p>
        </section>

        <section id="faq" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
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
            <div className="mt-12 rounded-xl bg-accent px-6 py-10 text-center text-accent-fg">
              <h2 className="font-display text-3xl">Twenty minutes to your first matches.</h2>
              <p className="mt-2 text-accent-fg/85">Paste your website. Upload one document. See what fits.</p>
              <Button asChild size="lg" variant="secondary" className="mt-6">
                <Link href="/sign-up">
                  Start free <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function HeroInbox() {
  return (
    <div className="relative min-w-0" aria-hidden>
      <div className="absolute inset-0 -z-10 rounded-[2rem] bg-accent-soft/60 blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-lg">
        <div className="border-b border-border bg-accent-soft/50 px-5 py-3">
          <p className="text-2xs font-semibold uppercase tracking-wider text-accent-soft-fg">This month</p>
          <p className="font-display text-lg text-fg">Your plan for October</p>
        </div>
        <ul className="divide-y divide-border">
          {[
            { t: "Youth Development Grants 2027", f: "The Meridian Family Foundation", s: 94, d: "Nov 20", a: "$40K" },
            { t: "Fall Responsive Grants", f: "Miami Valley Community Trust", s: 89, d: "Nov 6", a: "$20K" },
            { t: "STEM Futures Grant", f: "Brightwater Industries", s: 84, d: "Dec 15", a: "$45K" },
          ].map((r) => (
            <li key={r.t} className="flex items-center gap-3 px-5 py-3">
              <FitScore score={r.s} size="sm" showLabel={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{r.t}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {r.f} · Due {r.d} · Expected {r.a}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-fg-muted">About 14 hours of your time</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg">
            <Check className="size-3" /> Approve plan
          </span>
        </div>
      </div>
      <div className="ml-6 mt-3 rounded-lg border border-border bg-surface p-4 shadow-md sm:ml-12">
        <p className="text-xs text-fg-subtle">Proposal agent · 2 hours ago · 3 sources</p>
        <p className="mt-1 font-display text-base text-fg">Draft ready: Meridian, Youth Development Grants 2027</p>
        <div className="mt-2 flex gap-1.5">
          <Badge variant="accent">18 citations</Badge>
          <Badge variant="warning">4 questions</Badge>
        </div>
      </div>
    </div>
  );
}

function TrustCard() {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-6 shadow-md">
      <p className="text-xs font-medium text-fg-subtle">From a draft, Statement of need</p>
      <p className="mt-3 font-display text-lg leading-relaxed text-fg">
        Among seniors enrolled in After-School Studio, 94% graduated on time
        <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-2xs font-semibold text-accent-soft-fg">
          <FileText className="size-2.5" /> Annual report, p.6
        </span>
        compared with 81% district-wide. Demand is ahead of capacity:
        <span className="mx-1 inline-flex items-center rounded-md border border-dashed border-warning bg-warning-soft px-2 py-0.5 align-middle text-xs font-semibold text-warning-soft-fg">Need: current waitlist size</span>
        students are waiting at Belmont.
      </p>
      <div className="mt-5 rounded-md border border-border bg-surface p-4">
        <p className="text-sm font-medium text-fg">Youth Development Grants 2027</p>
        <p className="text-xs text-fg-muted">The Meridian Family Foundation · $10K to $50K · Due Nov 20, 2026</p>
        <VerifiedSource url="https://meridianfamilyfdn.org/grants/youth-development" verifiedAt="2026-10-14T08:00:00Z" className="mt-2" />
      </div>
    </div>
  );
}
