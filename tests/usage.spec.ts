import { expect, test } from "@playwright/test";
import { countRuns, kindOfRun, limitReachedMessage, summarize, usageSentence, USAGE_LIMITS, UsageLimitError } from "@/lib/usage/limits";
import { recordRun } from "@/lib/loop/runs";
import type { LoopStore } from "@/lib/loop/store";

const NOW = new Date("2026-10-22T12:00:00Z");
const run = (over: Partial<{ agent: string; title: string; usageKind: "draft" | "assist" | null; status: string; tokensIn: number; tokensOut: number; costUsd: number; startedAt: string }> = {}) => ({
  agent: "proposal",
  title: "Draft a letter of inquiry for X",
  usageKind: null,
  status: "succeeded",
  tokensIn: 1000,
  tokensOut: 500,
  costUsd: 0.01,
  startedAt: "2026-10-05T10:00:00Z",
  ...over,
});

test.describe("monthly AI allowance", () => {
  test("settings reads the way people talk", () => {
    expect(usageSentence("draft", 12)).toBe(`You have used 12 of ${USAGE_LIMITS.draft} drafts this month.`);
    const s = summarize({ draft: 3, assist: 41 }, NOW);
    expect(s.month).toBe("2026-10");
    expect(s.resetsOn).toBe("2026-11-01");
    expect(s.lines.map((l) => l.sentence)).toEqual([`You have used 3 of ${USAGE_LIMITS.draft} drafts this month.`, `You have used 41 of ${USAGE_LIMITS.assist} assistant runs this month.`]);
  });

  test("only this month's successful model runs count, by kind", () => {
    const counts = countRuns(
      [
        run(),
        run({ usageKind: "draft", title: "Anything" }),
        run({ agent: "discovery", title: "Score 12 notices" }),
        run({ status: "failed" }),
        run({ tokensIn: 0, tokensOut: 0, costUsd: 0 }),
        run({ startedAt: "2026-09-30T23:59:00Z" }),
      ],
      NOW,
    );
    expect(counts).toEqual({ draft: 2, assist: 1 });
  });

  test("older runs without a kind are classified from their title", () => {
    expect(kindOfRun({ agent: "proposal", title: "Draft a full proposal for Y" })).toBe("draft");
    expect(kindOfRun({ agent: "proposal", title: "Reviewer check for Y" })).toBe("assist");
    expect(kindOfRun({ agent: "outreach", title: "Draft a question email" })).toBe("assist");
  });

  test("the limit message says when it resets and who to ask", () => {
    const m = limitReachedMessage("draft", NOW);
    expect(m).toContain(`all ${USAGE_LIMITS.draft} drafts for October`);
    expect(m).toContain("November 1");
    expect(m).toContain("support@fundfellows.com");
    expect(m).not.toMatch(/[–—]/);
  });

  test("a real model run stops before it starts when the month's drafts are used", async () => {
    const before = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key-not-real";
    let created = 0;
    const store = {
      orgId: "org_test",
      usageThisMonth: async () => ({ draft: USAGE_LIMITS.draft, assist: 0 }),
      createRun: async (r: object) => {
        created++;
        return { ...r, id: "run_1" };
      },
      updateRun: async () => undefined,
    } as unknown as LoopStore;
    try {
      await expect(recordRun(store, { agent: "proposal", title: "Draft a letter", trigger: "user", usage: "draft" }, async () => ({ output: 1, summary: "done" }))).rejects.toBeInstanceOf(UsageLimitError);
      expect(created).toBe(0);
      // Other AI steps still run.
      const ok = await recordRun(store, { agent: "discovery", title: "Score notices", trigger: "user" }, async () => ({ output: 2, summary: "done" }));
      expect(ok.output).toBe(2);
      expect(ok.run.usageKind).toBe("assist");
    } finally {
      if (before === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = before;
    }
  });
});
