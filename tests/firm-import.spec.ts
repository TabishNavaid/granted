import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { mapPeople, mapProjects, parseTable, readDate, readMoney, readRegistrations } from "@/lib/firm/import";
import { readXlsx } from "@/lib/firm/xlsx";

const TODAY = new Date("2026-10-22T12:00:00Z");

test.describe("importing a firm's records from a spreadsheet", () => {
  test("an Excel workbook: columns are matched by the names firms use, and nothing is invented", async () => {
    const t = await readXlsx(readFileSync(path.join(__dirname, "fixtures", "import", "projects.xlsx")));
    expect(t.headers[0]).toBe("Project Name");
    const { items, issues, columns } = mapProjects(t, TODAY);
    expect(columns.client).toBe("Owner");
    expect(items).toHaveLength(2);
    const [a, b] = items;
    expect(a).toMatchObject({ name: "Fire Station No. 9", client: "City of San Marcos", clientType: "municipal", city: "San Marcos", state: "TX", completionDate: "2023-12-31", status: "completed", constructionCost: 4_850_000, role: "prime" });
    expect(a.reference).toMatchObject({ name: "Ana Ruiz", phone: "512-555-0101", organization: "City of San Marcos" });
    expect(b).toMatchObject({ clientType: "k12", constructionCost: 12_400_000, role: "subconsultant", status: "in_progress", reference: null, scope: "" });
    expect(issues.some((x) => /no description/.test(x.message))).toBe(true);
  });

  test("rows pasted from Excel (tab separated) and a CSV with quotes read the same way", () => {
    const tsv = "Name\tTitle\tDiscipline\tYears Experience\tYears with firm\tRegistrations\nMarisol Vega\tPrincipal\tArchitecture\t22\t14\tRA TX 23145; NCARB\nDev Patel\tProject Engineer\tCivil\t6\t\tEIT\n";
    const { items } = mapPeople(parseTable(tsv));
    expect(items[0]).toMatchObject({ name: "Marisol Vega", title: "Principal", discipline: "Architecture", yearsTotal: 22, yearsWithFirm: 14 });
    expect(items[0].registrations[0]).toMatchObject({ license: "RA", state: "TX", number: "23145" });
    expect(items[1].yearsWithFirm).toBeNull();
    const csv = 'First Name,Last Name,Title,Education\n"Ann","O\'Neil","Senior Engineer, Structural","BS Civil Engineering; MS Structural"\n';
    const p = mapPeople(parseTable(csv)).items[0];
    expect(p.name).toBe("Ann O'Neil");
    expect(p.title).toBe("Senior Engineer, Structural");
    expect(p.education).toEqual(["BS Civil Engineering", "MS Structural"]);
  });

  test("a sheet without a name column says so instead of guessing", () => {
    const r = mapProjects(parseTable("Client,City\nCity of Austin,Austin\n"), TODAY);
    expect(r.items).toHaveLength(0);
    expect(r.issues[0].message).toMatch(/project name/);
  });

  test("money, dates, and registrations", () => {
    expect(readMoney("$1,250,000")).toBe(1_250_000);
    expect(readMoney("850k")).toBe(850_000);
    expect(readMoney("TBD")).toBeNull();
    expect(readDate("3/2024")).toBe("2024-03-01");
    expect(readDate("06/30/2025")).toBe("2025-06-30");
    expect(readDate("soon")).toBeNull();
    expect(readRegistrations("PE OK 30112; PE TX 98765")).toEqual([
      { license: "PE", state: "OK", number: "30112", expires: null },
      { license: "PE", state: "TX", number: "98765", expires: null },
    ]);
  });
});
