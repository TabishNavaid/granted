"use client";

import * as React from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SocialCampaign, SocialPlatform, SocialPost } from "@/lib/types";
import { services } from "@/lib/services";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PageContainer, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const platformLabel: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
};

const platformOrder: SocialPlatform[] = ["instagram", "linkedin", "facebook", "x"];

const tiedToLabel: Record<SocialPost["tiedTo"]["kind"], string> = {
  application: "About an application",
  win: "A win",
  program: "A program",
  general: "General",
};

const X_LIMIT = 280;
const CHECK_MARKER = /\[check:[^\]]*\]/;

/** "2026-10" to a Date on the first of that month. */
function monthDate(month: string) {
  return parseISO(`${month}-01`);
}

function monthName(month: string) {
  return format(monthDate(month), "MMMM yyyy");
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SocialView({ campaigns: initial, demo }: { campaigns: SocialCampaign[]; demo: boolean }) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = React.useState(initial);
  const [month, setMonth] = React.useState(() => format(new Date(), "yyyy-MM"));
  const [planning, setPlanning] = React.useState(false);
  const [approving, setApproving] = React.useState(false);

  const campaign = campaigns.find((c) => c.month === month) ?? null;

  const putCampaign = (next: SocialCampaign) => {
    setCampaigns((list) => (list.some((c) => c.id === next.id) ? list.map((c) => (c.id === next.id ? next : c)) : [next, ...list]));
  };

  const plan = async () => {
    setPlanning(true);
    try {
      const result = await services.social.generate(month);
      if (result.ok) {
        putCampaign(result.data);
      } else {
        toast({ title: "Could not plan the month", description: result.error, tone: "warning" });
      }
    } finally {
      setPlanning(false);
    }
  };

  const approve = async () => {
    if (!campaign) return;
    setApproving(true);
    try {
      putCampaign(await services.social.approve(campaign.id));
      toast({ title: "Month approved", description: `${monthName(month)} is ready to copy and post.` });
    } finally {
      setApproving(false);
    }
  };

  const exportAs = async (fmt: "text" | "csv") => {
    if (!campaign) return;
    const body = await services.social.exportCampaign(campaign.id, fmt);
    download(`posts-${campaign.month}.${fmt === "text" ? "txt" : "csv"}`, body, fmt === "text" ? "text/plain;charset=utf-8" : "text/csv;charset=utf-8");
  };

  const updatePost = async (postId: string, patch: Partial<Pick<SocialPost, "text" | "date" | "status" | "platform">>) => {
    if (!campaign) return;
    setCampaigns((list) => list.map((c) => (c.id === campaign.id ? { ...c, posts: c.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)) } : c)));
    putCampaign(await services.social.updatePost(campaign.id, postId, patch));
  };

  const planButton = (
    <Button loading={planning} onClick={plan}>
      {planning ? "Planning" : campaign ? "Plan again" : "Plan this month"}
    </Button>
  );

  const posts = campaign ? [...campaign.posts].sort((a, b) => a.date.localeCompare(b.date)) : [];

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Social"
        description="A month of posts that show the work behind your applications. You copy them, and nothing is posted for you."
        actions={
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Month">
              <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(format(subMonths(monthDate(month), 1), "yyyy-MM"))}>
                <ChevronLeft />
              </Button>
              <span className="min-w-[9.5rem] text-center font-display text-base font-bold text-ink tnum" aria-live="polite">
                {monthName(month)}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(format(addMonths(monthDate(month), 1), "yyyy-MM"))}>
                <ChevronRight />
              </Button>
            </div>
            {planButton}
          </>
        }
      />
      {demo ? <p className="mt-4 text-sm text-ink-muted">Demo workspace: posts here are sample text until a model key is connected.</p> : null}

      {campaign ? (
        <section className="mt-8" aria-labelledby="campaign-theme">
          <p id="campaign-theme" className="max-w-[65ch] text-xl leading-normal text-ink">
            {campaign.theme}
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-muted">Status</dt>
              <dd className="font-semibold text-ink">{campaign.status === "approved" ? "Approved" : "Draft"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-muted">Posts</dt>
              <dd className="font-semibold text-ink tnum">{posts.length}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-muted">Skipped</dt>
              <dd className="font-semibold text-ink tnum">{posts.filter((p) => p.status === "skipped").length}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {campaign.status === "approved" ? null : (
              <Button loading={approving} onClick={approve}>
                {approving ? "Approving" : "Approve the month"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => exportAs("text")}>
              Export as text
            </Button>
            <Button variant="secondary" onClick={() => exportAs("csv")}>
              Export as CSV
            </Button>
          </div>

          <ol className="mt-8 border-t-2 border-ink" aria-label={`Posts for ${monthName(month)}`}>
            {posts.map((post) => (
              <PostRow key={post.id} post={post} onChange={(patch) => updatePost(post.id, patch)} onCopied={() => toast({ title: "Copied", description: "The post is on your clipboard.", tone: "info" })} />
            ))}
          </ol>
        </section>
      ) : (
        <div className="mt-8">
          <EmptyState title={`Nothing planned for ${monthName(month)}`} description="Plan the month and we draft a post for each application, program, and win worth showing." action={planButton} />
        </div>
      )}
    </PageContainer>
  );
}

function PostRow({ post, onChange, onCopied }: { post: SocialPost; onChange: (patch: Partial<Pick<SocialPost, "text" | "date" | "status" | "platform">>) => Promise<void>; onCopied: () => void }) {
  const [text, setText] = React.useState(post.text);
  const [date, setDate] = React.useState(post.date);
  // When the post is replaced from outside (a new plan), the drafts follow it.
  const [seen, setSeen] = React.useState({ text: post.text, date: post.date });
  if (seen.text !== post.text || seen.date !== post.date) {
    setSeen({ text: post.text, date: post.date });
    if (seen.text !== post.text) setText(post.text);
    if (seen.date !== post.date) setDate(post.date);
  }

  const skipped = post.status === "skipped";
  const overLimit = post.platform === "x" && text.length > X_LIMIT;
  const needsCheck = CHECK_MARKER.test(text);
  const textId = `post-${post.id}-text`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    onCopied();
  };

  const saveText = () => {
    if (text !== post.text) onChange({ text });
  };

  const saveDate = (value: string) => {
    setDate(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value !== post.date) onChange({ date: value });
  };

  return (
    <li className={cn("grid gap-5 border-b border-rule py-6 lg:grid-cols-[14rem_1fr]", skipped && "text-ink-muted")}>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm lg:flex-col lg:gap-y-3">
        <div>
          <dt className="text-ink-muted">Date</dt>
          <dd className={cn("font-semibold tnum", skipped ? "text-ink-muted" : "text-ink")}>{formatDate(post.date, "EEE, MMM d")}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Platform</dt>
          <dd className={cn("font-semibold", skipped ? "text-ink-muted" : "text-ink")}>{platformLabel[post.platform]}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{tiedToLabel[post.tiedTo.kind]}</dt>
          <dd className={cn("font-semibold", skipped ? "text-ink-muted" : "text-ink")}>{post.tiedTo.label}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Status</dt>
          <dd className={cn("font-semibold", skipped ? "text-ink-muted" : "text-ink")}>{skipped ? "Skipped" : post.status === "approved" ? "Approved" : "Draft"}</dd>
        </div>
      </dl>

      <div className="min-w-0">
        <Field id={textId} label="Post">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={saveText} disabled={skipped} className="min-h-28" />
        </Field>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className={cn("tnum", overLimit ? "font-semibold text-burgundy" : "text-ink-muted")} aria-live="polite">
            {text.length} characters{overLimit ? `, over the ${X_LIMIT} allowed on X` : ""}
          </span>
          {needsCheck ? <span className="text-ink">Check the bracketed number before you post.</span> : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id={`post-${post.id}-platform`} label="Platform">
            <Select value={post.platform} onValueChange={(v) => onChange({ platform: v as SocialPlatform })} disabled={skipped}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platformOrder.map((p) => (
                  <SelectItem key={p} value={p}>
                    {platformLabel[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`post-${post.id}-date`} label="Date">
            <Input type="date" value={date} onChange={(e) => saveDate(e.target.value)} disabled={skipped} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy} disabled={skipped}>
            Copy
          </Button>
          {skipped ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ status: "draft" })}>
              Keep
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onChange({ status: "skipped" })}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
