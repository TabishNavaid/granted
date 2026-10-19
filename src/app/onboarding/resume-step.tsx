"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { postUpload } from "@/lib/demo/upload";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/** Individuals start from a résumé: pasted, uploaded, or, in the demo, the sample student's. */
export function ResumeStep({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const read = async (input: Parameters<typeof services.person.readResume>[0]) => {
    setBusy(true);
    setError(null);
    const r = await services.person.readResume(input);
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.push("/onboarding/profile");
  };
  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("type", "resume");
    const { body } = await postUpload("/api/segments/upload", form);
    if (!body?.ok || !body.document) {
      setBusy(false);
      return setError(body?.error ?? "The upload did not go through. Try again.");
    }
    await read({ documentId: body.document.id });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-h1 text-ink">Start from your résumé.</h1>
      <p className="mt-4 max-w-[54ch] text-lg text-ink-muted">We read your education, experiences, and awards into a profile you check. Essays later use only what is in it, in your own words.</p>
      <div className="mt-8 flex flex-col gap-6">
        <Field id="resume-file" label="Upload it (PDF, Word, or text)">
          <Input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        {file ? (
          <Button className="self-start" onClick={upload} loading={busy}>
            Read my résumé
          </Button>
        ) : null}
        <Field id="resume-text" label="Or paste it">
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Button className="self-start" variant={file ? "secondary" : "primary"} onClick={() => read({ text })} loading={busy && !file} disabled={text.trim().split(/\s+/).length < 30}>
          Read the pasted résumé
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-6 border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
          {error}
        </p>
      ) : null}
      {demo ? (
        <div className="mt-10 max-w-xl border-t border-rule pt-5">
          <p className="text-base text-ink">In the demo, try the sample student: Jordan Reyes, a high school senior in Dayton, Ohio. The résumé is made up; the scholarship funds come from real IRS filings.</p>
          <Button variant="secondary" className="mt-3" onClick={() => read({ sample: true })} loading={busy}>
            Use the sample résumé
          </Button>
        </div>
      ) : null}
    </div>
  );
}
