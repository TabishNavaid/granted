"use client";

import * as React from "react";
import Link from "next/link";
import type { CopilotAnswer } from "@/lib/types";
import { services } from "@/lib/services";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

interface Turn {
  id: number;
  question: string;
  answer: CopilotAnswer | null;
  error: string | null;
}

let nextId = 0;

const linkClass = "text-ink underline decoration-[1px] underline-offset-4 hover:decoration-ink";

function SourceLink({ label, href }: { label: string; href: string }) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={linkClass}>
      {label}
    </Link>
  );
}

export function AskView({ starters }: { starters: string[] }) {
  const { toast } = useToast();
  const [question, setQuestion] = React.useState("");
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [engine, setEngine] = React.useState<CopilotAnswer["engine"] | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const boxRef = React.useRef<HTMLTextAreaElement>(null);

  const last = turns.at(-1);
  const suggestions = last?.answer?.suggestions?.length ? last.answer.suggestions : starters;

  React.useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns]);

  const ask = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    const id = ++nextId;
    setTurns((t) => [...t, { id, question: q, answer: null, error: null }]);
    setQuestion("");
    setBusy(true);
    try {
      const answer = await services.copilot.ask(q);
      setEngine(answer.engine);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Try again in a moment.";
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: message } : x)));
      toast({ title: "No answer this time", description: message, tone: "warning" });
    } finally {
      setBusy(false);
      boxRef.current?.focus();
    }
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title="Ask" description="Ask about your deadlines, funders, drafts, and results. Answers point to the records they came from." />

      {turns.length ? (
        <ol className="mt-8 border-t border-rule" aria-live="polite">
          {turns.map((t) => (
            <li key={t.id} className="border-b border-rule py-5">
              <p className="text-base font-semibold text-ink">{t.question}</p>
              {t.answer ? (
                <div className="mt-3">
                  <p className="whitespace-pre-line text-base leading-relaxed text-ink">{t.answer.answer}</p>
                  {t.answer.sources.length ? (
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                      <span>From</span>
                      {t.answer.sources.map((s) => (
                        <SourceLink key={s.href + s.label} label={s.label} href={s.href} />
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : t.error ? (
                <p className="mt-3 text-base text-alert">{t.error}</p>
              ) : (
                <p className="mt-3 text-base text-ink-muted">Looking through your records.</p>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      <div ref={endRef} />

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <Label htmlFor="ask-box">Your question</Label>
        <Textarea
          ref={boxRef}
          id="ask-box"
          className="mt-1.5"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(question);
            }
          }}
          placeholder="How many people did we serve last year?"
          aria-describedby="ask-hint"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p id="ask-hint" className="text-sm text-ink-muted">
            Enter to ask. Shift and Enter for a new line.
          </p>
          <Button type="submit" loading={busy} disabled={!question.trim()}>
            Ask
          </Button>
        </div>
        {engine === "rules" ? <p className="mt-3 text-sm text-ink-muted">Answers come from your own records. With a model key set, Ask can answer anything about the account.</p> : null}
      </form>

      <section aria-labelledby="suggest-title" className="mt-8">
        <h2 id="suggest-title" className="text-base font-semibold text-ink">
          {turns.length ? "You could also ask" : "Try one of these"}
        </h2>
        <ul className="mt-2 flex flex-col items-start gap-1">
          {suggestions.map((s) => (
            <li key={s}>
              <Button variant="link" className="h-auto whitespace-normal py-1 text-left" onClick={() => void ask(s)} disabled={busy}>
                {s}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
