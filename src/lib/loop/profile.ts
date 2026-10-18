import { getAi, type JsonSchema, type TokenUsage } from "@/lib/ai";
import type { CrawledPage } from "@/lib/crawl";
import type { FactCategory } from "@/lib/types";
import { contains, numbersCovered, truncate } from "./text";

/**
 * Profile extraction. One model call reads every crawled page and returns a
 * structured profile plus facts. Each fact must quote the passage it came
 * from; code then checks that the passage really is on that page and that
 * every number in the value appears in the passage. Facts that fail are
 * dropped and counted, never shown.
 */
export interface ExtractedProfile {
  name: string;
  mission: string;
  programs: string[];
  populations: string[];
  causes: string[];
  city: string;
  state: string;
  serviceArea: string;
  annualBudget: string;
  foundedYear: string;
  staffSize: string;
}

export interface ExtractedFact {
  label: string;
  value: string;
  category: FactCategory;
  sourceUrl: string;
  excerpt: string;
}

export interface ProfileExtraction {
  profile: ExtractedProfile;
  facts: ExtractedFact[];
  dropped: { fact: ExtractedFact; reason: string }[];
  model: string;
  usage: TokenUsage;
  costUsd: number;
  durationMs: number;
}

const CATEGORIES: FactCategory[] = ["reach", "outcomes", "finance", "organization", "geography", "people"];

const schema: JsonSchema = {
  type: "object",
  properties: {
    profile: {
      type: "object",
      properties: {
        name: { type: "string", description: "The organization's name as written on its site." },
        mission: { type: "string", description: "The mission statement, quoted or closely paraphrased from the site. Empty if none is stated." },
        programs: { type: "array", items: { type: "string" }, description: "Named programs or services, each a short phrase." },
        populations: { type: "array", items: { type: "string" }, description: "Who the organization serves, as stated." },
        causes: { type: "array", items: { type: "string" }, description: "Two to five cause areas in plain words, e.g. Youth development, Food security, Rural health, Arts." },
        city: { type: "string" },
        state: { type: "string", description: "Two-letter US state code if stated, else empty." },
        serviceArea: { type: "string", description: "The geography served, as stated. Empty if not stated." },
        annualBudget: { type: "string", description: "Annual budget or expenses, only if a figure is stated on the site. Empty otherwise." },
        foundedYear: { type: "string", description: "Year founded, only if stated. Empty otherwise." },
        staffSize: { type: "string", description: "Number of staff, only if stated. Empty otherwise." },
      },
      required: ["name", "mission", "programs", "populations", "causes", "city", "state", "serviceArea", "annualBudget", "foundedYear", "staffSize"],
    },
    facts: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "What the fact is, e.g. 'People served in 2025', 'Year founded', 'Counties served'." },
          value: { type: "string", description: "The value exactly as the page states it, e.g. '214', '$342,000', 'Montgomery County'." },
          category: { type: "string", enum: CATEGORIES },
          sourceUrl: { type: "string", description: "The URL of the page the fact was read from, copied exactly from the page header." },
          excerpt: { type: "string", description: "A short passage, at most 200 characters, copied verbatim from that page, containing the value." },
        },
        required: ["label", "value", "category", "sourceUrl", "excerpt"],
      },
    },
  },
  required: ["profile", "facts"],
};

const SYSTEM = `You read a nonprofit's own website and write down only what it says. You are building a knowledge base that a grant writer will cite, so precision matters more than completeness.

Rules:
- Every fact's excerpt must be copied character for character from the page named in sourceUrl. Do not paraphrase inside an excerpt. Keep excerpts under 200 characters.
- Every number in a value must appear in the excerpt. Never infer, estimate, add up, or round a number.
- If a field is not stated anywhere on these pages, leave it empty. An empty field is correct; a guess is wrong.
- Prefer facts a funder would care about: people served, outcomes, budget, year founded, staff, volunteers, geography, programs, partners, awards.
- Each fact is one label and one value. Do not repeat the same fact from two pages.
- Mission: quote the mission statement if the site has one. Otherwise summarize the stated purpose in one sentence.`;

function pagesPrompt(pages: CrawledPage[]): string {
  return pages
    .map((p, i) => `=== PAGE ${i + 1} ===\nURL: ${p.url}\nTITLE: ${p.title}\n\n${p.text}`)
    .join("\n\n");
}

function urlsMatch(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();
  return norm(a) === norm(b);
}

export function validateFacts(raw: ExtractedFact[], pages: CrawledPage[]): { facts: ExtractedFact[]; dropped: { fact: ExtractedFact; reason: string }[] } {
  const facts: ExtractedFact[] = [];
  const dropped: { fact: ExtractedFact; reason: string }[] = [];
  const seenLabels = new Set<string>();
  for (const f of raw) {
    const fact: ExtractedFact = {
      label: truncate((f.label ?? "").trim(), 80),
      value: (f.value ?? "").trim(),
      category: CATEGORIES.includes(f.category) ? f.category : "organization",
      sourceUrl: (f.sourceUrl ?? "").trim(),
      excerpt: truncate((f.excerpt ?? "").trim(), 240),
    };
    if (!fact.label || !fact.value || !fact.excerpt) {
      dropped.push({ fact, reason: "missing label, value, or excerpt" });
      continue;
    }
    const page = pages.find((p) => urlsMatch(p.url, fact.sourceUrl)) ?? pages.find((p) => contains(p.text, fact.excerpt));
    if (!page) {
      dropped.push({ fact, reason: "source URL is not a page we read" });
      continue;
    }
    if (!contains(page.text, fact.excerpt)) {
      dropped.push({ fact, reason: "excerpt is not on the page" });
      continue;
    }
    const cov = numbersCovered(fact.value, fact.excerpt);
    if (!cov.ok) {
      dropped.push({ fact, reason: `number ${cov.missing.join(", ")} is not in the excerpt` });
      continue;
    }
    const key = fact.label.toLowerCase();
    if (seenLabels.has(key)) {
      dropped.push({ fact, reason: "duplicate label" });
      continue;
    }
    seenLabels.add(key);
    fact.sourceUrl = page.url;
    facts.push(fact);
  }
  return { facts, dropped };
}

export async function extractProfile(pages: CrawledPage[]): Promise<ProfileExtraction> {
  const ai = getAi();
  const res = await ai.generateJson<{ profile: ExtractedProfile; facts: ExtractedFact[] }>({
    tier: "lite",
    label: "extract_profile",
    system: SYSTEM,
    prompt: `Read these ${pages.length} pages from one organization's website and return the profile and facts.\n\n${pagesPrompt(pages)}`,
    schema,
    maxOutputTokens: 8192,
  });
  const profile = res.data.profile;
  const clean: ExtractedProfile = {
    name: (profile?.name ?? "").trim(),
    mission: (profile?.mission ?? "").trim(),
    programs: (profile?.programs ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    populations: (profile?.populations ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 10),
    causes: (profile?.causes ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 6),
    city: (profile?.city ?? "").trim(),
    state: (profile?.state ?? "").trim().toUpperCase().slice(0, 2),
    serviceArea: (profile?.serviceArea ?? "").trim(),
    annualBudget: (profile?.annualBudget ?? "").trim(),
    foundedYear: (profile?.foundedYear ?? "").trim(),
    staffSize: (profile?.staffSize ?? "").trim(),
  };
  // Numbers in the profile must also be on the site somewhere, or they go.
  const allText = pages.map((p) => p.text).join("\n");
  for (const key of ["annualBudget", "foundedYear", "staffSize"] as const) {
    if (clean[key] && !numbersCovered(clean[key], allText).ok) clean[key] = "";
  }
  const { facts, dropped } = validateFacts(res.data.facts ?? [], pages);
  return { profile: clean, facts, dropped, model: res.model, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
}
