import { SAMPLE_RFP } from "@/lib/replay/recordings/firm-rfp";
import { readRfp } from "@/lib/bids/rfp";
const r = readRfp([{ page: 1, text: SAMPLE_RFP.text }], { title: SAMPLE_RFP.title, number: SAMPLE_RFP.number, naics: [...SAMPLE_RFP.naics], setAside: SAMPLE_RFP.setAside, placeOfPerformance: SAMPLE_RFP.placeOfPerformance, dueDate: SAMPLE_RFP.dueDate, type: "SF330" });
for (const q of r.requirements) console.log(`${q.key} [${q.kind}/${q.sectionKey}] ${q.excerpt.slice(0, 110)}`);
console.log(JSON.stringify(r.solicitation.dates), r.dueDate);
