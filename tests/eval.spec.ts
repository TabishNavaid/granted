import { expect, test } from "@playwright/test";
import { addresses, compare, headings, pageLimit, rougeL, terms } from "@/lib/eval/compare";
import { SAMPLE_RFP } from "@/lib/replay/recordings/firm-rfp";

// Two stand-in documents written for this test. They are not anyone's proposal.
const thorough = `Cover Letter
This electronic cover letter precedes our other data. It outlines the work our firm specializes in: architecture and engineering for clinics and outpatient buildings.
Our firm is a certified service-disabled veteran-owned small business, registered in SAM; the SAM print out is attached.
SF 330 Part I
Sections A through E are complete. We provide licensed professionals in the State where each project is located, with current professional registrations in Texas according to FAR Part 36.
Section F Example Projects
Examples of completed projects similar to the work required, each on one page.
Qualifications
Professional qualifications necessary for satisfactory performance of the required services. Specialized experience and technical competence in the type of work required. Capacity to accomplish the work in the required time. Past performance on contracts with Government agencies and private industry. Location in the general geographical area of the projects.
SF 330 Part II
Part II is complete. All submittal documents, including the cover letter, are in a single PDF, and only the first twenty pages will be considered, so the submission is within twenty pages.`;
const thin = `Letter
We are a design firm and would like to be considered for future work.`;

test.describe("draft evaluation", () => {
  test("a document that answers the solicitation covers more of its requirements than one that does not", () => {
    const pages = [{ page: 1, text: SAMPLE_RFP.text }];
    const c = compare({ rfpPages: pages, draft: thin, winner: thorough });
    expect(c.requirements).toBeGreaterThan(5);
    expect(c.winnerCovers).toBeGreaterThan(c.draftCovers);
    expect(c.missedByDraft.length).toBeGreaterThan(0);
    expect(c.headings.winner).toEqual(expect.arrayContaining(["SF 330 Part I", "Section F Example Projects"]));
  });

  test("measures behave", () => {
    expect(pageLimit("All documents count towards the limit of 20 pages.")).toBe(20);
    expect(pageLimit("Proposals shall not exceed fifteen (15) pages.")).toBe(15);
    expect(pageLimit("No limit is stated.")).toBeNull();
    expect(rougeL("the fire station renovation", "the fire station renovation")).toBe(1);
    expect(rougeL("fire station", "clinic expansion")).toBe(0);
    expect(terms("Drawings and Registrations")).toEqual(["drawing", "registration"]);
    expect(addresses({ title: "Professional registrations", excerpt: "current relevant professional registration in a State" }, new Set(terms("current professional registration in Texas state")))).toBe(true);
    expect(headings("1. Approach\nWe will do the work carefully.\nProject Team")).toEqual(["1. Approach", "Project Team"]);
  });
});
