import type { Addendum, BidDate } from "@/lib/types";
import { datesIn } from "./rfp";

/**
 * Reads an addendum with rules: a new due date, new or changed dates for
 * questions and site visits, questions and answers, and lines that add,
 * delete, revise, or replace something. The firm can edit every change.
 */
export interface ReadAddendum {
  number: string;
  issuedOn: string | null;
  summary: string;
  changes: Addendum["changes"];
  /** Dates the addendum sets, to move on the calendar. */
  dates: BidDate[];
}

export function readAddendum(text: string, previous: { dueDate: string | null; dates: BidDate[] }, known: { number?: string } = {}): ReadAddendum {
  // "Q1." and "A1." label questions and answers; keep them attached to their text.
  const flat = text.replace(/\r/g, "").replace(/(^|\n)\s*([QA])(\d{1,3})[.)]\s+/g, "$1$2$3: ");
  const number = known.number ?? flat.match(/\b(A\d{4})\b/)?.[1] ?? flat.match(/\b(?:addendum|amendment)\s*(?:no\.?|number|#)\s*([0-9A-Z]{1,6})\b/i)?.[1] ?? flat.match(/\b(?:addendum|amendment)\s+(\d{1,3})\b/i)?.[1] ?? "1";
  const issued = flat.match(/\b(?:date(?:d)?|issued(?: on)?)\s*:?\s*([A-Za-z]+\.? \d{1,2},? 20\d\d|\d{1,2}\/\d{1,2}\/20\d\d)/i);
  const issuedOn = issued ? (datesIn(issued[1])[0]?.iso ?? null) : null;
  const changes: Addendum["changes"] = [];
  const dates: BidDate[] = [];
  const sentences = flat.split(/\n+|(?<=[.;])\s+(?=[A-Z])/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 12);

  for (const s of sentences) {
    const ds = datesIn(s);
    if (ds.length && /\b(due|deadline|closing|received|submission|proposals?|bids?|offers?|response)\b/i.test(s) && /\b(extend|change|revise|move|now|new|postpone|is hereby)\b/i.test(s)) {
      const after = ds[ds.length - 1].iso;
      changes.push({ kind: "date", text: s, before: previous.dueDate, after, ref: null });
      dates.push({ kind: "submission", date: after, label: "Proposals due", note: s, ref: `Addendum ${number}` });
      continue;
    }
    if (ds.length && /\b(questions?|inquir|site visit|walk-?through|pre-?bid|pre-?proposal)\b/i.test(s)) {
      const kind: BidDate["kind"] = /questions?|inquir/i.test(s) ? "questions_due" : /site visit|walk/i.test(s) ? "site_visit" : "prebid_meeting";
      const before = previous.dates.find((d) => d.kind === kind)?.date ?? null;
      changes.push({ kind: "date", text: s, before, after: ds[ds.length - 1].iso, ref: null });
      dates.push({ kind, date: ds[ds.length - 1].iso, label: kind === "questions_due" ? "Questions due" : kind === "site_visit" ? "Site visit" : "Pre-bid meeting", note: s, ref: `Addendum ${number}` });
      continue;
    }
    if (!ds.length && /\b(extend|extends|extended|postpone)\b[^.]{0,40}\b(deadline|due date|closing date|submission)/i.test(s)) {
      changes.push({ kind: "date", text: s, before: previous.dueDate, after: null, ref: null });
      continue;
    }
    const fromTo = s.match(/\b(increased|decreased|reduced|raised|changed|revised|extended|moved)\s+from\s+(.{1,60}?)\s+to\s+(.{1,60}?)(?=[.;,]|$)/i);
    if (fromTo) {
      changes.push({ kind: /\b(shall|must|page|submit|cap|limit)\b/i.test(s) ? "requirement" : "scope", text: s, before: fromTo[2].trim(), after: fromTo[3].trim(), ref: null });
      continue;
    }
    if (/^(Q(uestion)?\s*\d*[:.)]|\d+\.\s*Q[:.])/i.test(s)) {
      changes.push({ kind: "answer", text: s, before: null, after: null, ref: null });
      continue;
    }
    if (/^(A(nswer)?\s*\d*[:.)]|Response[:.])/i.test(s) && changes.length && changes[changes.length - 1].kind === "answer" && !changes[changes.length - 1].after) {
      changes[changes.length - 1].after = s.replace(/^(A(nswer)?\s*\d*[:.)]|Response[:.])\s*/i, "");
      continue;
    }
    if (/\b(SF\s?-?\s?\d+|form|attachment|exhibit)\b/i.test(s) && /\b(add|replace|revise|delete|remove|substitute|attached)\b/i.test(s)) {
      changes.push({ kind: "form", text: s, before: null, after: null, ref: s.match(/\b(section|paragraph|page|attachment|exhibit)\s+[\w.-]+/i)?.[0] ?? null });
      continue;
    }
    if (/\b(is hereby|are hereby)?\s*(added|deleted|revised|replaced|changed|amended|removed|clarified)\b/i.test(s) || /^(add|delete|revise|replace|change)\b/i.test(s)) {
      const isReq = /\b(shall|must|required|submit|page limit|pages?)\b/i.test(s);
      changes.push({ kind: isReq ? "requirement" : "scope", text: s, before: null, after: null, ref: s.match(/\b(section|paragraph|page|sheet|specification)\s+[\w.-]+/i)?.[0] ?? null });
    }
  }
  const counts = { date: 0, answer: 0, requirement: 0, scope: 0, form: 0, other: 0 } as Record<Addendum["changes"][number]["kind"], number>;
  for (const c of changes) counts[c.kind]++;
  const due = changes.find((c) => c.kind === "date" && dates.some((d) => d.kind === "submission" && d.date === c.after));
  const bits = [
    due ? `moves the due date to ${due.after}` : changes.some((c) => c.kind === "date" && !c.after) ? "extends the deadline without a new date in the text; check the notice for it" : null,
    counts.answer ? `answers ${counts.answer} question${counts.answer === 1 ? "" : "s"}` : null,
    counts.requirement ? `changes ${counts.requirement} requirement${counts.requirement === 1 ? "" : "s"}` : null,
    counts.scope ? `changes the scope in ${counts.scope} place${counts.scope === 1 ? "" : "s"}` : null,
    counts.form ? `changes ${counts.form} form${counts.form === 1 ? "" : "s"} or attachment${counts.form === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return { number, issuedOn, summary: bits.length ? `Addendum ${number} ${bits.join(", ")}.` : `Addendum ${number}: we found no dated or marked changes. Read it in full.`, changes, dates };
}
