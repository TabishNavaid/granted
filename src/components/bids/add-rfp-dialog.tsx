"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Link2, ClipboardPaste } from "lucide-react";
import { services } from "@/lib/services";
import { postUpload } from "@/lib/demo/upload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ProgressSteps, type JobView } from "@/components/app/progress-steps";
import { newJobId, watchJob, finalJob, runLong } from "@/lib/progress-client";

const STEPS: JobView = { status: "running", steps: [{ label: "Reading the solicitation", state: "active" }, { label: "Building the compliance matrix", state: "pending" }, { label: "Scoring go or no-go", state: "pending" }, { label: "Planning the deadlines", state: "pending" }] };

/** Add an RFP the firm already has: a link, the file, or its text. Most firms start here. */
export function AddRfpDialog({ demo, trigger, samNoticeId }: { demo: boolean; trigger?: React.ReactNode; samNoticeId?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState(samNoticeId ? "sam" : "upload");
  const [url, setUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [job, setJob] = React.useState<JobView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const stop = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => stop.current?.(), []);

  const run = async (input: Parameters<typeof services.bids.addRfp>[0]) => {
    setError(null);
    const jobId = newJobId();
    setJob(STEPS);
    stop.current = watchJob(jobId, setJob);
    const r = await runLong(jobId, "bids.addRfp", [{ ...input, jobId }], () => services.bids.addRfp({ ...input, jobId }));
    stop.current?.();
    if (!r.ok) {
      setJob(null);
      setError(r.error);
      return;
    }
    setJob(await finalJob(jobId, STEPS));
    router.push(`/applications/${r.data.applicationId}?from=rfp`);
  };

  const upload = async () => {
    if (!file) return setError("Choose the solicitation file first.");
    setError(null);
    setJob(STEPS);
    const form = new FormData();
    form.set("file", file);
    form.set("type", "rfp");
    const { body } = await postUpload("/api/segments/upload", form);
    if (!body?.ok || !body.document) {
      setJob(null);
      return setError(body?.error ?? "The upload did not go through. Try again.");
    }
    await run({ documentId: body.document.id });
  };

  const busy = job !== null && job.status !== "done";
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>{trigger ?? <Button>Add an RFP</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add an RFP</DialogTitle>
          <DialogDescription>We read it into a compliance matrix, score go or no-go from your records, and put its dates on the calendar. Nothing is submitted for you.</DialogDescription>
        </DialogHeader>
        {job ? (
          <div className="mt-2">
            <ProgressSteps job={job} />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-2">
            <TabsList variant="pill" aria-label="How to add the solicitation">
              {samNoticeId ? <TabsTrigger value="sam">From SAM.gov</TabsTrigger> : null}
              <TabsTrigger value="upload">
                <FileUp className="size-4" aria-hidden /> Upload
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 className="size-4" aria-hidden /> Link
              </TabsTrigger>
              <TabsTrigger value="paste">
                <ClipboardPaste className="size-4" aria-hidden /> Paste text
              </TabsTrigger>
            </TabsList>
            {samNoticeId ? (
              <TabsContent value="sam" className="mt-5">
                <p className="text-base text-ink-muted">We will read this notice from SAM.gov, including its description.</p>
                <Button className="mt-5" onClick={() => run({ samNoticeId })}>
                  Read the notice
                </Button>
              </TabsContent>
            ) : null}
            <TabsContent value="upload" className="mt-5">
              <Field id="rfp-file" label="The solicitation (PDF, Word, or text)">
                <Input type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Field>
              <p className="mt-2 text-sm text-ink-muted">PDFs are read page by page, so every requirement in the matrix says which page it is on.</p>
              <Button className="mt-5" onClick={upload} disabled={!file}>
                Read the RFP
              </Button>
            </TabsContent>
            <TabsContent value="link" className="mt-5">
              <Field id="rfp-url" label="Link to the solicitation or its PDF">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
              </Field>
              <p className="mt-2 text-sm text-ink-muted">If the owner&apos;s portal needs a login, download the file and upload it instead.</p>
              <Button className="mt-5" onClick={() => run({ url })} disabled={!url.trim()}>
                Read the RFP
              </Button>
            </TabsContent>
            <TabsContent value="paste" className="mt-5">
              <Field id="rfp-text" label="The solicitation's text">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
              </Field>
              <Button className="mt-5" onClick={() => run({ text })} disabled={text.trim().split(/\s+/).length < 80}>
                Read the RFP
              </Button>
            </TabsContent>
          </Tabs>
        )}
        {error ? (
          <p role="alert" className="mt-4 border-l-[6px] border-alert py-1 pl-4 text-base text-ink">
            {error}
          </p>
        ) : null}
        {demo && !job ? (
          <div className="mt-6 border-t border-rule pt-4">
            <p className="text-base text-ink-muted">In the demo, try a real public notice: the VA&apos;s architect-engineer short selection database for Texas (SAM.gov, solicitation 36C25723R0049).</p>
            <Button variant="secondary" className="mt-3" onClick={() => run({ sample: true })}>
              Use the sample notice
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
