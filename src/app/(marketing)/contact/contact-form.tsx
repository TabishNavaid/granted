"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function ContactForm({ canSend, address }: { canSend: boolean; address: string | null }) {
  const [form, setForm] = React.useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "show_address" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mailto = address ? `mailto:${address}?subject=${encodeURIComponent("Hello")}&body=${encodeURIComponent(form.message)}` : null;

  if (state === "sent") {
    return (
      <div className="max-w-[60ch]">
        <h2 className="font-display text-3xl text-ink">Got it.</h2>
        <p className="mt-3 text-lg text-ink-muted">We read every message and answer within two working days.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
      <form
        className="flex max-w-xl flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!form.email.includes("@")) return setError("Add an email address we can answer.");
          if (form.message.trim().length < 5) return setError("Tell us a little more so we can help.");
          if (!canSend) return setState("show_address");
          setState("sending");
          try {
            const r = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
            const data = (await r.json()) as { ok: boolean; sent?: boolean; error?: string };
            if (!r.ok || !data.ok) {
              setState("error");
              setError(data.error ?? "We could not send that. Try again.");
              return;
            }
            setState(data.sent ? "sent" : "show_address");
          } catch {
            setState("error");
            setError("We could not reach the server. Try again in a moment.");
          }
        }}
      >
        <Field id="c-name" label="Your name" optional>
          <Input autoComplete="name" value={form.name} onChange={set("name")} />
        </Field>
        <Field id="c-email" label="Email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field id="c-message" label="Message">
          <Textarea required rows={6} value={form.message} onChange={set("message")} />
        </Field>
        <div className="hidden" aria-hidden>
          <label htmlFor="c-website">Website</label>
          <input id="c-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </div>
        {error ? (
          <p role="alert" className="border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
            {error}
          </p>
        ) : null}
        {state === "show_address" ? (
          <div className="border-l-[6px] border-ink py-1 pl-4 text-base text-ink">
            {address ? (
              <>
                <p>Our contact form is not connected to email yet. Send this to us directly:</p>
                <p className="mt-2 font-semibold">
                  <a href={mailto ?? `mailto:${address}`} className="underline decoration-[1.5px] underline-offset-4 hover:decoration-corn">
                    {address}
                  </a>
                </p>
              </>
            ) : (
              <p>Our contact form is not connected yet and no address is set. This will be fixed before launch.</p>
            )}
          </div>
        ) : null}
        <div>
          <Button type="submit" size="lg" loading={state === "sending"}>
            {canSend ? "Send message" : "Send message"}
          </Button>
        </div>
      </form>
      <aside className="border-l-2 border-rule-strong pl-5 text-base text-ink-muted lg:self-start">
        <h2 className="font-display text-xl text-ink">What to expect</h2>
        <p className="mt-3">A reply from a person within two working days. We do not add you to a list.</p>
        {address ? (
          <p className="mt-3">
            Or write directly to{" "}
            <a href={`mailto:${address}`} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-corn">
              {address}
            </a>
            .
          </p>
        ) : null}
      </aside>
    </div>
  );
}
