/**
 * The demo's inline editor action. The real one is reviseHtml in src/lib/loop/revise.ts, which calls the model;
 * this stub applies a visible, deterministic change so the editor can be tried without a key.
 */
import type { ReviseAction, ReviseTone } from "@/lib/loop/revise";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ReviseTextInput {
  html: string;
  action: ReviseAction;
  tone?: ReviseTone;
  wordLimit?: number | null;
}
export interface ReviseTextOutput {
  html: string;
  note: string;
}
/**
 * Inline editor action. The stub applies a visible, deterministic transformation
 * so the UI can be exercised; the real implementation calls the model with revise_text.
 */
export async function reviseText(input: ReviseTextInput): Promise<ReviseTextOutput> {
  await delay(900);
  const { html, action, tone } = input;
  const protect: string[] = [];
  const shielded = html.replace(/<span data-(citation|gap)="[^"]*"[^>]*><\/span>/g, (m) => {
    protect.push(m);
    return `\u0000${protect.length - 1}\u0000`;
  });
  let out = shielded;
  let note = "";
  if (action === "shorten") {
    out = shielded
      .replace(/\b(very|really|truly|deliberately|simply|just)\s+/gi, "")
      .replace(/,\s+which is[^.,;]*(?=[.,;])/g, "")
      .replace(/\bin order to\b/gi, "to");
    note = "Trimmed filler words and one aside.";
  } else if (action === "expand") {
    out = shielded.replace(/<\/p>\s*$/, " We will report on each of these points in our mid-year update.</p>");
    note = "Added a closing sentence that points to reporting.";
  } else if (action === "tone") {
    const map: Record<ReviseTone, [RegExp, string][]> = {
      plain: [[/\butilize\b/gi, "use"], [/\bin order to\b/gi, "to"]],
      warm: [[/\bstudents\b/g, "our students"], [/\bWe\b/g, "Together, we"]],
      formal: [[/\bkids\b/gi, "students"], [/\bget\b/g, "receive"], [/\bfun\b/g, "engaging"]],
      confident: [[/\bwe hope to\b/gi, "we will"], [/\btry to\b/gi, ""], [/\bmay\b/g, "will"]],
    };
    for (const [re, rep] of map[tone ?? "plain"]) out = out.replace(re, rep);
    note = `Adjusted wording toward a ${tone ?? "plain"} tone.`;
  } else {
    out = shielded.replace(/\bThe structure is simple on purpose\./, "We keep the structure simple by design.");
    note = "Rewrote for flow. Facts and citations unchanged.";
  }
  const restored = out.replace(/\u0000(\d+)\u0000/g, (_, i) => protect[Number(i)]);
  return { html: restored, note };
}
