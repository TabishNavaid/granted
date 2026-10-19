import type { Recording } from "../types";
import { SAMPLE_RESUME } from "./student-resume";

/**
 * Jordan Reyes, a fictional high school senior in Dayton, Ohio, applying for
 * scholarships. The résumé is made up. The scholarship funds come from real
 * IRS 990-PF filings; the essay prompt is an example a student would paste
 * from a sponsor's application, not the fund's own prompt.
 */
export const EXAMPLE_ESSAY_PROMPT = "Tell us about a time you took responsibility for something in your community, and how it shaped what you want to study.";

export const recording: Recording = {
  id: "student",
  recordedOn: "2026-10-18",
  site: { homepage: "", pages: [], skipped: [] },
  calls: [
    {
      label: "read_resume",
      durationMs: 4100,
      data: {
        experiences: [
          { title: "Captain", organization: "Belmont Ridge Robotics Team", years: "2025 - present", detail: "Led a team of 14 students to design and build a competition robot. Started a Saturday build night so students with after-school jobs could take part." },
          { title: "Sales associate", organization: "Hollis Hardware", years: "2024 - present", detail: "Work 15 hours a week while in school, helping customers find parts for home repairs. Trained three new employees on the store's inventory system." },
          { title: "Volunteer", organization: "Mad River Cleanup Crew", years: "2023 - present", detail: "Helped remove more than 2 tons of trash from the riverbank over three seasons. Mapped the worst stormwater outfalls on the river with a GPS app for the city's watershed office." },
          { title: "Tutor", organization: "Riverbend Youth Collective After-School Studio", years: "2024 - present", detail: "Tutor middle school students in algebra two afternoons a week." },
        ],
        field: "civil engineering",
        goals: "I want to study civil engineering and design stormwater systems that keep rivers like the Mad River clean, then come back to Dayton to work for the city.",
      },
    },
    {
      label: "draft_essay",
      match: "Scholarship: Bernard-Wentz Scholarship Fund",
      durationMs: 9400,
      data: {
        text: "The first time I walked the Mad River with the cleanup crew, I thought our job was trash. Over three seasons we pulled more than 2 tons of it off the riverbank [[fact:rec_exp_3]]. But the trash kept coming back, and I started to notice where it came from: the pipes that drain the streets into the river.\n\nSo I took on a job nobody had asked for. With a GPS app on my phone, I mapped the worst stormwater outfalls along the river and gave the map to the city's watershed office [[fact:rec_exp_3]]. [[gap:outfall_result]]\n\nTaking responsibility is something I practice in smaller ways too. On the robotics team, I noticed that the students who worked after school could never come to build nights, so as captain I started a Saturday build night for them [[fact:rec_exp_1]]. I work 15 hours a week at a hardware store myself [[fact:rec_exp_2]], so I knew that problem from the inside.\n\nThe outfall map is why I want to study civil engineering [[fact:rec_goals]]. A volunteer crew can clean a riverbank, but only a better drainage system keeps it clean. I want to design stormwater systems that keep rivers like the Mad River clean, then come back to Dayton to work for the city [[fact:rec_goals]].",
        gaps: [
          { key: "outfall_result", question: "What happened after you gave the map to the watershed office? Did anyone use it, or did you learn something from their answer?", whyItMatters: "Readers remember what came of the work. Only you know how it ended.", suggestedLabel: "What came of the outfall map" },
        ],
      },
    },
  ],
  grantsgov: { recordedAt: "2026-10-18", searches: {}, details: {} },
};

export { SAMPLE_RESUME };
