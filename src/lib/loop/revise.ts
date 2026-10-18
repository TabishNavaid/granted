import { getAi } from "@/lib/ai";

export type ReviseAction = "rewrite" | "shorten" | "expand" | "tone";
export type ReviseTone = "plain" | "warm" | "formal" | "confident";

/**
 * Inline editor actions. Citation and gap chips are swapped for placeholders
 * before the model sees the text and must all come back, or the original is
 * kept. The model cannot add a number that was not already in the text.
 */
export async function reviseHtml(input: { html: string; action: ReviseAction; tone?: ReviseTone; wordLimit?: number | null }): Promise<{ html: string; note: string; usage: { inputTokens: number; outputTokens: number; thoughtTokens: number }; costUsd: number; model: string }> {
  const protect: string[] = [];
  const shielded = input.html.replace(/<span data-(citation|gap)="[^"]*"[^>]*><\/span>/g, (m) => {
    protect.push(m);
    return `{{chip${protect.length - 1}}}`;
  });
  const numbersBefore = new Set((shielded.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) ?? []).map((n) => n.replace(/[$,%]/g, "")));
  const ask =
    input.action === "shorten"
      ? `Shorten it by about a third${input.wordLimit ? `, to at most ${input.wordLimit} words` : ""}. Keep every fact and every {{chip}} marker.`
      : input.action === "expand"
        ? "Expand it by about a third with more specific detail drawn only from what is already written. Do not add new facts or numbers."
        : input.action === "tone"
          ? `Rewrite it in a ${input.tone ?? "plain"} tone. Keep every fact, number, and {{chip}} marker exactly where it belongs.`
          : "Rewrite it to read more clearly and specifically. Keep every fact, number, and {{chip}} marker.";
  const ai = getAi();
  const res = await ai.generateJson<{ html: string }>({
    tier: "standard",
    label: `revise_${input.action}`,
    system: `You edit grant proposal text for a small nonprofit. The text is simple HTML (p, h3, ul, ol, li, strong, em). Markers like {{chip3}} are citations or gaps: keep every one of them, in the sentence it belongs to, unchanged. Never introduce a number, name, or claim that is not in the text. No em dashes. Return the edited HTML only.`,
    prompt: `${ask}\n\nText:\n${shielded}`,
    schema: { type: "object", properties: { html: { type: "string" } }, required: ["html"] },
    maxOutputTokens: 4096,
  });
  let out = (res.data.html ?? "").trim();
  const missing = protect.map((_, i) => `{{chip${i}}}`).filter((m) => !out.includes(m));
  const numbersAfter = (out.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) ?? []).map((n) => n.replace(/[$,%]/g, ""));
  const invented = numbersAfter.filter((n) => !numbersBefore.has(n));
  if (!out || missing.length || invented.length) {
    return { html: input.html, note: missing.length ? "The rewrite dropped a citation, so we kept your text." : invented.length ? "The rewrite added a number that was not there, so we kept your text." : "The rewrite came back empty, so we kept your text.", usage: res.usage, costUsd: res.costUsd, model: res.model };
  }
  out = out.replace(/\{\{chip(\d+)\}\}/g, (_m, i) => protect[Number(i)] ?? "");
  if (!/^\s*</.test(out)) out = `<p>${out}</p>`;
  const words = out.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return { html: out, note: `Now ${words} words.`, usage: res.usage, costUsd: res.costUsd, model: res.model };
}
