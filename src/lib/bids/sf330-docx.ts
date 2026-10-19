import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { Sf330 } from "@/lib/types";

/**
 * The SF 330 as a Word file, block by block in the form's own numbering, for
 * the firm to check and transfer into the official GSA form (Rev. 7/2021).
 * It is a working copy, and says so on its first line; nothing here is
 * signed or submitted.
 */
const p = (text: string, bold = false) => new Paragraph({ children: [new TextRun({ text, bold })], spacing: { after: 80 } });
const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) => new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
const row = (cells: string[], header = false) => new TableRow({ children: cells.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: header })] })] })) });
const table = (head: string[], body: string[][]) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [row(head, true), ...body.map((r) => row(r))] });

function sf330Document(sf: Sf330): Document {
  const a = sf.partI;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: "Working copy in the structure of Standard Form 330 (Rev. 7/2021), Architect-Engineer Qualifications. Check every block and transfer it to the official form before signing.", italics: true })] }),
    h("PART I. CONTRACT-SPECIFIC QUALIFICATIONS", HeadingLevel.HEADING_1),
    h("A. Contract information"),
    p(`1. Title and location: ${a.a.title}${a.a.location ? `, ${a.a.location}` : ""}`),
    p(`2. Public notice date: ${a.a.date ?? ""}`),
    p(`3. Solicitation or project number: ${a.a.number ?? ""}`),
    h("B. Architect-engineer point of contact"),
    p(`4. Name and title: ${a.b ? `${a.b.name}, ${a.b.title}` : ""}`),
    p(`5. Name of firm: ${a.b?.firm ?? ""}`),
    p(`6. Telephone: ${a.b?.phone ?? ""}`),
    p(`8. Email: ${a.b?.email ?? ""}`),
    h("C. Proposed team"),
    table(["Role", "9. Firm name", "10. Address", "11. Role in this contract"], a.c.map((c) => [c.isPrime ? "Prime" : "Subcontractor", c.firm, c.address, c.role])),
    h("D. Organizational chart of proposed team"),
    p(a.d.note),
    h("E. Résumés of key personnel proposed for this contract"),
  ];
  for (const r of a.e) {
    children.push(
      p(`12. Name: ${r.name}`, true),
      p(`13. Role in this contract: ${r.role}`),
      p(`14. Years of experience: total ${r.yearsTotal ?? ""}, with current firm ${r.yearsWithFirm ?? ""}`),
      p(`15. Firm name and location: ${r.firmAndLocation}`),
      p(`16. Education: ${r.education.join("; ")}`),
      p(`17. Current professional registration: ${r.registrations.join("; ")}`),
      p(`18. Other professional qualifications: ${r.other}`),
      p("19. Relevant projects:"),
      ...r.projects.map((x) => p(`${x.title}, ${x.location}${x.year ? `, ${x.year}` : ""}. ${x.description}${x.withThisFirm ? " (performed with current firm)" : ""}`)),
    );
  }
  children.push(h("F. Example projects which best illustrate proposed team's qualifications for this contract"));
  for (const f of a.f) {
    children.push(
      p(`20. Example project key number: ${f.key}`, true),
      p(`21. Title and location: ${f.title}, ${f.location}`),
      p(`22. Year completed: professional services ${f.completed.professional ?? ""}; construction ${f.completed.construction ?? ""}`),
      p(`23. Project owner: ${f.owner}${f.pointOfContact ? `; point of contact ${f.pointOfContact}` : ""}`),
      p(`24. Brief description: ${f.description}`),
      p(`25. Firms from Section C involved: ${f.firms.map((x) => `${x.name}, ${x.location}, ${x.role}`).join("; ")}`),
    );
  }
  children.push(h("G. Key personnel participation in example projects"));
  children.push(table(["26. Name", "27. Role", ...a.g.projects.map((x) => x.key)], a.g.people.map((x) => [x.name, x.role, ...a.g.projects.map((pp) => (x.marks.includes(pp.key) ? "X" : ""))])));
  children.push(p(`29. Example projects key: ${a.g.projects.map((x) => `${x.key}. ${x.title}`).join("; ")}`));
  children.push(h("H. Additional information"), p(a.h || "Not written yet."));
  children.push(h("I. Authorized representative"), p(`31. Name and title: ${a.i.name}${a.i.title ? `, ${a.i.title}` : ""}`), p("30. Signature and date: sign on the official form."));
  const b = sf.partII;
  children.push(
    h("PART II. GENERAL QUALIFICATIONS", HeadingLevel.HEADING_1),
    p(`2a. Firm name: ${b.firmName}`),
    p(`2b-e. Address: ${b.address}`),
    p(`3. Year established: ${b.yearEstablished ?? ""}`),
    p(`4. Unique Entity Identifier: ${b.uei ?? ""}`),
    p(`5. Ownership and small business status: ${b.smallBusinessStatus ?? ""}`),
    p("9. Employees by discipline:"),
    table(["Function code", "Discipline", "Number of employees"], b.disciplines.map((d) => [d.code ?? "", d.discipline, String(d.count)])),
    p("10. Profile of firm's experience:"),
    table(["Profile code", "Experience", "Number of projects", "Revenue index"], b.experience.map((e) => [e.code, e.label, String(e.projects), e.revenueIndex ?? ""])),
    p(`11. Annual average professional services revenues (index): federal ${b.averageAnnualRevenue?.federal ?? ""}; non-federal ${b.averageAnnualRevenue?.nonFederal ?? ""}; total ${b.averageAnnualRevenue?.total ?? ""}`),
  );
  if (sf.missing.length) children.push(h("Still to supply before signing"), ...sf.missing.map((m) => p(`- ${m}`)));
  return new Document({ creator: "SF 330 working copy", title: `SF 330: ${a.a.title}`, sections: [{ children }] });
}

/** For the download route. */
export function sf330Docx(sf: Sf330): Promise<Buffer> {
  return Packer.toBuffer(sf330Document(sf));
}

/** For the browser demo, where the bid lives in the visitor's browser. */
export function sf330Blob(sf: Sf330): Promise<Blob> {
  return Packer.toBlob(sf330Document(sf));
}

export function sf330FileName(sf: Sf330): string {
  return `SF330-${(sf.partI.a.number ?? sf.partI.a.title).replace(/[^\w-]+/g, "_").slice(0, 60)}.docx`;
}
