"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { AgentMark } from "@/components/app/badges";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const questions = [
  { id: "budget", text: "Thanks, Dana. Your 990 says about $342,000 in expenses last year. Is that still roughly where you are this year?", why: "Funders filter by budget size, so this one really matters." },
  { id: "geo", text: "Your site mentions Belmont and Stivers. Which neighborhoods or ZIP codes do most of your students come from? Rough is fine.", why: "Many funders restrict by county, city, or ZIP." },
  { id: "proud", text: "Last one, and it's the good one. What's a result from the past year you're proudest of? A number is great. A story is just as good.", why: "It becomes the opening of your need statement." },
];

interface Msg {
  id: string;
  from: "agent" | "you";
  text: string;
  why?: string;
}

export function InterviewStep() {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Msg[]>([
    { id: "intro", from: "agent", text: "Hi, I'm the one who read riverbendyouth.org and the documents you added. I've got three quick questions to fill in the gaps, and then you can check everything." },
    { id: questions[0].id, from: "agent", text: questions[0].text, why: questions[0].why },
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
        setMessages((m) => [...m, { id: q.id, from: "agent", text: q.text, why: q.why }]);
      } else {
        setMessages((m) => [...m, { id: "done", from: "agent", text: "That's everything. I put your profile and facts together on the next page. Have a look, especially at the numbers. You know them better than I do." }]);
      }
    }, 900);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <div>
        <h1 className="font-display text-3xl text-fg sm:text-4xl">A few questions.</h1>
        <p className="mt-3 max-w-xl text-base text-fg-muted">Short answers are fine. You can change anything later, really.</p>
        <div className="mt-8 rounded-lg border border-border bg-surface">
          <div role="log" aria-live="polite" aria-label="Interview" className="flex max-h-[28rem] min-h-[20rem] flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.from === "you" && "flex-row-reverse")}>
                {m.from === "agent" ? <AgentMark agent="profile" size="sm" className="mt-0.5" /> : <Avatar name="Dana Okafor" size="sm" className="mt-0.5" />}
                <div className={cn("max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed", m.from === "agent" ? "bg-surface-sunken text-fg" : "bg-accent text-accent-fg")}>
                  <p>{m.text}</p>
                  {m.why ? <p className="mt-1.5 text-xs text-fg-subtle">Why we ask: {m.why}</p> : null}
                </div>
              </div>
            ))}
            {typing ? (
              <div className="flex gap-3">
                <AgentMark agent="profile" size="sm" />
                <div className="flex items-center gap-1 rounded-lg bg-surface-sunken px-3.5 py-3" aria-label="Agent is typing">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 animate-pulse rounded-full bg-fg-subtle" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
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
              placeholder={done ? "All done" : "Type your answer. Enter to send, Shift+Enter for a new line."}
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
            Check my profile <ArrowRight aria-hidden />
          </Button>
          {!done ? (
            <Button variant="ghost" size="lg" onClick={() => router.push("/onboarding/profile")}>
              Skip the rest
            </Button>
          ) : null}
        </div>
      </div>
      <aside className="rounded-lg border border-border bg-surface p-5 text-sm text-fg-muted lg:self-start">
        <p className="font-medium text-fg">Progress</p>
        <ol className="mt-3 flex flex-col gap-2">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", i < step ? "bg-accent" : i === step ? "bg-warning" : "bg-border-strong")} aria-hidden />
              <span className={cn(i < step && "line-through")}>
                {i === 0 ? "Budget" : i === 1 ? "Geography" : "A result you are proud of"}
              </span>
              <span className="sr-only">{i < step ? ", answered" : i === step ? ", current" : ", not yet"}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
