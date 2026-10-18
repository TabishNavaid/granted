"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const questions = [
  { id: "budget", text: "Thanks, Dana. Your 990 says about $342,000 in expenses last year. Is that still roughly where you are this year?", why: "Funders filter by budget size, so this one really matters." },
  { id: "geo", text: "Your site mentions Belmont and Stivers. Which neighborhoods or ZIP codes do most of your students come from? Rough is fine.", why: "Many funders restrict by county, city, or ZIP." },
  { id: "proud", text: "Last one, and it's the good one. What's a result from the past year you're proudest of? A number is great. A story is just as good.", why: "It becomes the opening of your need statement." },
];

interface Msg {
  id: string;
  from: "product" | "you";
  text: string;
  why?: string;
}

const topics = ["Budget", "Geography", "A result you are proud of"];

export function InterviewStep() {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Msg[]>([
    { id: "intro", from: "product", text: "Hi, I'm the one who read riverbendyouth.org and the documents you added. I've got three quick questions to fill in the gaps, and then you can check everything." },
    { id: questions[0].id, from: "product", text: questions[0].text, why: questions[0].why },
  ]);
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const done = step >= questions.length;

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, typing]);

  const send = () => {
    if (!draft.trim() || done) return;
    const text = draft.trim();
    setDraft("");
    setMessages((m) => [...m, { id: `you-${step}`, from: "you", text }]);
    const nextStep = step + 1;
    setStep(nextStep);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      if (nextStep < questions.length) {
        const q = questions[nextStep];
        setMessages((m) => [...m, { id: q.id, from: "product", text: q.text, why: q.why }]);
      } else {
        setMessages((m) => [...m, { id: "done", from: "product", text: "That's everything. I put your profile and facts together on the next page. Have a look, especially at the numbers. You know them better than I do." }]);
      }
    }, 900);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-h1 text-ink">A few questions.</h1>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">Short answers are fine. You can change anything later, really.</p>
        <div className="sheet mt-8">
          <div role="log" aria-live="polite" aria-label="Interview" className="flex max-h-[28rem] min-h-[20rem] flex-col gap-5 overflow-y-auto p-4 sm:p-5">
            {messages.map((m) =>
              m.from === "product" ? (
                <div key={m.id} className="flex max-w-[85%] flex-col gap-1">
                  <span className="text-xs font-semibold text-ink">{PRODUCT_NAME}</span>
                  <div className="border border-rule bg-paper-tint px-4 py-3 text-base text-ink">
                    <p>{m.text}</p>
                    {m.why ? <p className="mt-2 text-sm text-ink-muted">Why we ask: {m.why}</p> : null}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-row-reverse items-start gap-3">
                  <Avatar name="Dana Okafor" size="sm" className="mt-0.5" />
                  <div className="max-w-[85%] bg-ink px-4 py-3 text-base text-paper">
                    <p>{m.text}</p>
                  </div>
                </div>
              ),
            )}
            {typing ? (
              <div className="flex max-w-[85%] flex-col gap-1">
                <span className="text-xs font-semibold text-ink">{PRODUCT_NAME}</span>
                <div className="flex w-fit items-center gap-1.5 border border-rule bg-paper-tint px-4 py-4" aria-label={`${PRODUCT_NAME} is typing`}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse bg-ink" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          <form
            className="flex items-end gap-2 border-t border-ink p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label htmlFor="answer" className="sr-only">
              Your answer
            </label>
            <Textarea
              id="answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={done ? "All done" : "Type your answer"}
              disabled={done}
              className="min-h-11 flex-1 resize-none"
              rows={1}
            />
            <Button type="submit" size="icon" aria-label="Send answer" disabled={done || !draft.trim()}>
              <Send />
            </Button>
          </form>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => router.push("/onboarding/profile")} disabled={!done}>
            Check my profile
          </Button>
          {!done ? (
            <Button variant="ghost" size="lg" onClick={() => router.push("/onboarding/profile")}>
              Skip the rest
            </Button>
          ) : null}
        </div>
      </div>
      <aside className="border-l-2 border-ink pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">Progress</h2>
        <ol className="mt-3 flex flex-col divide-y divide-rule border-y border-rule">
          {questions.map((q, i) => {
            const state = i < step ? "answered" : i === step ? "now" : "next";
            return (
              <li key={q.id} className="flex items-baseline justify-between gap-4 py-2">
                <span className={cn(state === "answered" && "line-through", state === "now" && "font-semibold text-ink")}>{topics[i]}</span>
                {state === "answered" ? <span className="text-sm text-ink-muted">Answered</span> : null}
                {state === "now" ? (
                  <span className="text-sm font-semibold">
                    <mark className="highlight">Now</mark>
                  </span>
                ) : null}
                {state === "next" ? <span className="text-sm text-ink-muted">Next</span> : null}
                <span className="sr-only">{i < step ? ", answered" : i === step ? ", current" : ", not yet"}</span>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
