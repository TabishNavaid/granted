import type { GrantsGovRecording, RecordedCall, Recording } from "../types";
import grantsgov from "./lab.grantsgov.json";

/**
 * The Lake Erie Freshwater Systems Lab at Maumee Bay State University, a
 * fictional university lab in Toledo, Ohio. The university, the lab, its
 * people, and its papers are made up; its website below does not exist. The
 * Grants.gov notices and the NSF and NIH funded projects (lab.analogs.json)
 * are real, fetched on the day in `recordedOn`.
 */
const HOME = "https://freshwaterlab.maumeebay.example.edu/";

export const labDrafts: RecordedCall[] = [
  {
    label: "draft_research",
    match: "Opportunity: Cooperative Agreement for Affiliated Partner with the Great Lakes-Northern Forest",
    durationMs: 14200,
    data: {
      sections: [
        {
          key: "summary",
          text: "The Lake Erie Freshwater Systems Lab proposes to contribute high-frequency water quality observations and satellite estimates of algal bloom extent from western Lake Erie to the USGS effort to improve habitat models for freshwater organisms. Our buoy network has measured the western basin every 15 minutes, May through October, since 2019 [[fact:{{fact:Monitoring record}}]], and our satellite and buoy estimates of bloom extent are published [[fact:rec_pub_2]]. [[gap:cesu_partner]]",
        },
        {
          key: "aims",
          text: "Aim 1. Supply habitat condition layers for western Lake Erie from 12 buoys that measure phycocyanin, chlorophyll, temperature, and dissolved oxygen [[fact:{{fact:Buoy network}}]], for use in evaluating the environmental sensitivity of habitat models (the notice's second technical area).\n\nAim 2. Compare buoy readings with satellite estimates of bloom extent across the western basin [[fact:rec_pub_2]] to measure how bloom conditions change habitat for aquatic organisms. [[gap:species_link]]",
        },
        {
          key: "plan",
          text: "Data. We pair buoy sensors with weekly toxin sampling [[fact:{{fact:Forecast lead time}}]], and we analyze toxins in a wet laboratory with ELISA and liquid chromatography mass spectrometry [[fact:rec_fac_1]].\n\nApproach. [[gap:sdm_approach]]\n\nTeam. Dr. Anika Sorensen leads the freshwater microbiology and toxin work [[fact:rec_inv_1]], Dr. Marcus Hale leads the sensor network and telemetry [[fact:rec_inv_2]], and Dr. Lena Ortiz leads remote sensing [[fact:rec_inv_3]].",
        },
        {
          key: "impacts",
          text: "We already share our data openly with the drinking water plants that draw from the lake [[fact:{{fact:Open data}}]]. Four graduate students and six undergraduate researchers work in the lab each year [[fact:{{fact:Lab team}}]] and would take part in the analysis.",
        },
        { key: "budget_justification", text: "[[gap:budget_lines]]" },
        {
          key: "data_management",
          text: "Buoy data are collected every 15 minutes during the field season [[fact:{{fact:Monitoring record}}]] and shared openly today [[fact:{{fact:Open data}}]]. [[gap:repository]]",
        },
      ],
      gaps: [
        { key: "cesu_partner", question: "Is Maumee Bay State University a participating partner of the Great Lakes-Northern Forest CESU? Only partners may apply.", whyItMatters: "The notice limits eligibility to CESU partners. If the university is not one, it cannot apply.", suggestedLabel: "CESU partner status" },
        { key: "species_link", question: "Which fish or aquatic species data, if any, has the team worked with, or would a partner bring it?", whyItMatters: "The notice is about species distributions and habitat for aquatic organisms, not water quality alone.", suggestedLabel: "Species data and partners" },
        { key: "sdm_approach", question: "How would you use the buoy and satellite data in species distribution or habitat models? Name the methods you would use.", whyItMatters: "Reviewers will look for the statistical methods in the notice's first technical area.", suggestedLabel: "Modeling approach" },
        { key: "budget_lines", question: "What would the budget pay for: people, field season costs, equipment, travel? Enter the numbers in the budget.", whyItMatters: "A budget justification explains each line; the numbers come from you.", suggestedLabel: "Budget lines" },
        { key: "repository", question: "Which public repository would hold the data, and how soon after collection would it be released?", whyItMatters: "A data management plan names the repository and the release schedule.", suggestedLabel: "Data repository and release" },
      ],
    },
  },
];

export const recording: Recording = {
  id: "lab",
  recordedOn: "2026-10-18",
  site: {
    homepage: HOME,
    pages: [
      {
        url: HOME,
        title: "Lake Erie Freshwater Systems Lab",
        kind: "html",
        text: `Lake Erie Freshwater Systems Lab
Department of Environmental Sciences, Maumee Bay State University, Toledo, Ohio.
We study harmful algal blooms in western Lake Erie and how to warn drinking water plants before toxins reach their intakes.
Our buoy network has measured water quality in the western basin every 15 minutes, May through October, since 2019.
We share our data openly with the drinking water plants that draw from the lake.`,
      },
      {
        url: "https://freshwaterlab.maumeebay.example.edu/people",
        title: "People",
        kind: "html",
        text: `People
Dr. Anika Sorensen, Associate Professor of Environmental Sciences, principal investigator. Freshwater microbiology and cyanotoxins.
Dr. Marcus Hale, Assistant Professor of Electrical Engineering, co-investigator. Low-power sensor networks and telemetry.
Dr. Lena Ortiz, Postdoctoral researcher. Remote sensing of algal blooms from satellite imagery.
Four graduate students and six undergraduate researchers work in the lab each year.`,
      },
      {
        url: "https://freshwaterlab.maumeebay.example.edu/research",
        title: "Research",
        kind: "html",
        text: `Research
Early warning for drinking water. We pair buoy sensors with weekly toxin sampling to predict when microcystin concentrations at water intakes will rise, three to five days ahead.
Sensor networks. Our 12 buoys measure phycocyanin, chlorophyll, temperature, and dissolved oxygen and report over cellular telemetry.
Remote sensing. We compare satellite estimates of bloom extent with buoy readings to map blooms across the whole western basin.`,
      },
      {
        url: "https://freshwaterlab.maumeebay.example.edu/publications",
        title: "Publications",
        kind: "html",
        text: `Selected publications
Sorensen A, Hale M, Ortiz L. Forecasting microcystin at drinking water intakes from high-frequency buoy data. Journal of Great Lakes Research, 2025.
Ortiz L, Sorensen A. Satellite and buoy estimates of cyanobacterial bloom extent in western Lake Erie. Remote Sensing of Environment, 2024.
Hale M, Sorensen A. A solar-powered sensor buoy for nearshore water quality monitoring. Environmental Science and Technology Letters, 2023.`,
      },
      {
        url: "https://freshwaterlab.maumeebay.example.edu/facilities",
        title: "Facilities and funding",
        kind: "html",
        text: `Facilities
The lab has a 1,200 square foot wet laboratory with an ELISA plate reader and a liquid chromatography mass spectrometer for toxin analysis, shared with the department.
The university's field station on Maumee Bay has a dock, a 24-foot research vessel, and space to build and repair buoys.
Funding
Our buoy network was built with a three-year state water quality research grant that ended in 2024.`,
      },
    ],
    skipped: [],
  },
  calls: [
    {
      label: "extract_profile",
      durationMs: 6400,
      data: {
        profile: {
          name: "Lake Erie Freshwater Systems Lab",
          mission: "We study harmful algal blooms in western Lake Erie and how to warn drinking water plants before toxins reach their intakes.",
          programs: [],
          populations: [],
          causes: ["Harmful algal blooms", "Drinking water safety", "Freshwater science"],
          city: "Toledo",
          state: "OH",
          serviceArea: "Western Lake Erie",
          annualBudget: "",
          foundedYear: "",
          staffSize: "",
        },
        facts: [
          { label: "Buoy network", value: "12 buoys measuring phycocyanin, chlorophyll, temperature, and dissolved oxygen", category: "organization", sourceUrl: "https://freshwaterlab.maumeebay.example.edu/research", excerpt: "Our 12 buoys measure phycocyanin, chlorophyll, temperature, and dissolved oxygen and report over cellular telemetry." },
          { label: "Monitoring record", value: "Every 15 minutes, May through October, since 2019", category: "outcomes", sourceUrl: HOME, excerpt: "Our buoy network has measured water quality in the western basin every 15 minutes, May through October, since 2019." },
          { label: "Forecast lead time", value: "three to five days ahead", category: "outcomes", sourceUrl: "https://freshwaterlab.maumeebay.example.edu/research", excerpt: "We pair buoy sensors with weekly toxin sampling to predict when microcystin concentrations at water intakes will rise, three to five days ahead." },
          { label: "Lab team", value: "Four graduate students and six undergraduate researchers each year", category: "people", sourceUrl: "https://freshwaterlab.maumeebay.example.edu/people", excerpt: "Four graduate students and six undergraduate researchers work in the lab each year." },
          { label: "Open data", value: "Data shared openly with the drinking water plants that draw from the lake", category: "organization", sourceUrl: HOME, excerpt: "We share our data openly with the drinking water plants that draw from the lake." },
        ],
      },
    },
    {
      label: "extract_research",
      durationMs: 5800,
      data: {
        institution: "Maumee Bay State University",
        department: "Department of Environmental Sciences",
        investigators: [
          { name: "Dr. Anika Sorensen", title: "Associate Professor of Environmental Sciences", role: "pi", expertise: ["Freshwater microbiology", "Cyanotoxins"], excerpt: "Dr. Anika Sorensen, Associate Professor of Environmental Sciences, principal investigator." },
          { name: "Dr. Marcus Hale", title: "Assistant Professor of Electrical Engineering", role: "co_pi", expertise: ["Low-power sensor networks", "Telemetry"], excerpt: "Dr. Marcus Hale, Assistant Professor of Electrical Engineering, co-investigator." },
          { name: "Dr. Lena Ortiz", title: "Postdoctoral researcher", role: "postdoc", expertise: ["Remote sensing of algal blooms"], excerpt: "Dr. Lena Ortiz, Postdoctoral researcher." },
        ],
        publications: [
          { title: "Forecasting microcystin at drinking water intakes from high-frequency buoy data", venue: "Journal of Great Lakes Research", year: 2025, authors: "Sorensen A, Hale M, Ortiz L", excerpt: "Forecasting microcystin at drinking water intakes from high-frequency buoy data. Journal of Great Lakes Research, 2025." },
          { title: "Satellite and buoy estimates of cyanobacterial bloom extent in western Lake Erie", venue: "Remote Sensing of Environment", year: 2024, authors: "Ortiz L, Sorensen A", excerpt: "Satellite and buoy estimates of cyanobacterial bloom extent in western Lake Erie. Remote Sensing of Environment, 2024." },
          { title: "A solar-powered sensor buoy for nearshore water quality monitoring", venue: "Environmental Science and Technology Letters", year: 2023, authors: "Hale M, Sorensen A", excerpt: "A solar-powered sensor buoy for nearshore water quality monitoring. Environmental Science and Technology Letters, 2023." },
        ],
        priorAwards: [{ funder: "State water quality research grant", title: "Buoy network for western Lake Erie", amount: null, startYear: null, endYear: 2024, role: "PI", excerpt: "Our buoy network was built with a three-year state water quality research grant that ended in 2024." }],
        facilities: [
          { name: "Wet laboratory", description: "1,200 square feet, with an ELISA plate reader and a liquid chromatography mass spectrometer for toxin analysis, shared with the department", excerpt: "The lab has a 1,200 square foot wet laboratory with an ELISA plate reader and a liquid chromatography mass spectrometer for toxin analysis, shared with the department." },
          { name: "Maumee Bay field station", description: "A dock, a 24-foot research vessel, and space to build and repair buoys", excerpt: "The university's field station on Maumee Bay has a dock, a 24-foot research vessel, and space to build and repair buoys." },
        ],
        capabilities: ["High-frequency buoy monitoring", "Cyanotoxin analysis by ELISA and LC-MS", "Satellite remote sensing of blooms", "Forecasting toxins at drinking water intakes"],
        keywords: ["harmful algal bloom", "freshwater", "water quality sensor", "Great Lakes"],
      },
    },
  ],
  grantsgov: grantsgov as unknown as GrantsGovRecording,
};

recording.calls.push(...labDrafts);
