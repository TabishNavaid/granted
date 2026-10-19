/**
 * Copy for the "What help costs" section on the home page.
 * A sourced figure lists its source; when it changes, update `checked`.
 */

export const checked = { iso: "2026-10-18", label: "October 2026", long: "18 October 2026" };

export type Source = { id: string; title: string; publisher: string; url: string };

export const sources: Source[] = [
  { id: "gpa-survey", title: "NextLevel University, citing the 2023 Compensation and Benefits Survey", publisher: "Grant Professionals Association", url: "https://grantprofessionals.org/news/675311/page/nextlevel_university" },
];

export function source(id: string): Source {
  const s = sources.find((x) => x.id === id);
  if (!s) throw new Error(`No source called ${id}`);
  return s;
}

export const helpCosts: { label: string; cost: string; detail: string; sources: string[] }[] = [
  { label: "A freelance grant writer", cost: "$80 to $90 an hour", detail: "Typical consultant rates in the Grant Professionals Association's 2023 survey, which includes part-time consultants. Experienced full-time writers often charge more.", sources: ["gpa-survey"] },
  { label: "A grant writer on retainer", cost: "$2,000 a month or more", detail: "For one to three proposals a month and some strategy. Retainers vary widely by writer and region.", sources: [] },
];
