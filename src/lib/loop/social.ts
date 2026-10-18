import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { Fact, Organization, SocialPlatform, SocialPost } from "@/lib/types";
import { numberKey, numbersIn } from "./text";

export interface CampaignInput {
  month: string;
  org: Organization;
  facts: Fact[];
  programs: string[];
  applications: { id: string; title: string; funder: string; deadline: string | null }[];
  wins: { id: string; title: string; funder: string; amount: number | null }[];
}

const schema: JsonSchema = {
  type: "object",
  properties: {
    theme: { type: "string", description: "One sentence on what the month's posts are about and why, tied to the applications and wins." },
    posts: {
      type: "array",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["instagram", "linkedin", "facebook", "x"] },
          day: { type: "integer", minimum: 1, maximum: 28 },
          text: { type: "string", description: "The post, in the organization's voice. Under 280 characters for x, under 700 otherwise. Hashtags only if natural, at most two." },
          tiedKind: { type: "string", enum: ["application", "win", "program", "general"] },
          tiedId: { type: "string", description: "The application or win id when tiedKind is application or win, else empty." },
          tiedLabel: { type: "string", description: "What it is about, e.g. the program name or the funder." },
        },
        required: ["platform", "day", "text", "tiedKind", "tiedId", "tiedLabel"],
      },
    },
  },
  required: ["theme", "posts"],
};

/**
 * A month of posts that show the work behind the applications in flight, so a
 * funder who looks the organization up sees momentum. Numbers not in a fact
 * are bracketed [check: X]. Nothing is posted anywhere.
 */
export async function generateCampaign(input: CampaignInput): Promise<{ theme: string; posts: SocialPost[]; usage: TokenUsage; costUsd: number; model: string }> {
  const ai = getAi();
  const res = await ai.generateJson<{ theme: string; posts: { platform: SocialPlatform; day: number; text: string; tiedKind: SocialPost["tiedTo"]["kind"]; tiedId: string; tiedLabel: string }[] }>({
    tier: "standard",
    label: "social_campaign",
    system: `You plan a month of social posts for a small nonprofit. Every post is true and specific: use only the facts, programs, applications, and wins listed. Never invent a number, a quote, a person, or an event. Posts timed before an application deadline should show the program that application funds. A win gets a thank-you post naming the funder. Warm, plain, first person plural. No em dashes, no exclamation marks, no emoji.`,
    prompt: [
      `Month: ${input.month}`,
      `Organization: ${input.org.name}${input.org.mission ? `. Mission: ${input.org.mission}` : ""}`,
      `Programs: ${input.programs.join("; ") || "(none listed)"}`,
      `Confirmed facts:\n${input.facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "- (none)"}`,
      `Applications in progress:\n${input.applications.map((a) => `- id=${a.id} ${a.title} (${a.funder})${a.deadline ? `, due ${a.deadline}` : ""}`).join("\n") || "- (none)"}`,
      `Recent wins:\n${input.wins.map((w) => `- id=${w.id} ${w.title} (${w.funder})${w.amount ? `, $${w.amount.toLocaleString("en-US")}` : ""}`).join("\n") || "- (none)"}`,
    ].join("\n\n"),
    schema,
    maxOutputTokens: 6000,
  });
  const allowed = new Set<string>();
  for (const f of input.facts) for (const n of numbersIn(`${f.value} ${f.sourceExcerpt}`)) allowed.add(numberKey(n));
  for (const w of input.wins) if (w.amount) allowed.add(numberKey(String(w.amount)));
  for (const a of input.applications) if (a.deadline) for (const n of numbersIn(a.deadline)) allowed.add(numberKey(n));
  const [y, m] = input.month.split("-").map(Number);
  const posts: SocialPost[] = (res.data.posts ?? []).map((p, i) => {
    const text = (p.text ?? "").replace(/\$?\d[\d,]*(?:\.\d+)?%?/g, (tok) => (allowed.has(numberKey(tok)) || !numberKey(tok) ? tok : `[check: ${tok}]`));
    const day = Math.max(1, Math.min(28, Math.round(p.day || i * 3 + 1)));
    return {
      id: `post_${i + 1}`,
      platform: p.platform,
      date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      text: text.trim(),
      tiedTo: { kind: p.tiedKind ?? "general", id: p.tiedId?.trim() || null, label: (p.tiedLabel ?? "").trim() },
      status: "draft",
    };
  });
  posts.sort((a, b) => a.date.localeCompare(b.date));
  return { theme: (res.data.theme ?? "").trim(), posts, usage: res.usage, costUsd: res.costUsd, model: res.model };
}
