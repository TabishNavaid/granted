/**
 * Tool definitions for the Claude API (Messages API tool use).
 * Each agent is given a subset of these. The backend implements the handlers;
 * the shapes here are the contract between prompt and code.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const orgId = { type: "string", description: "Organization id" };

export const tools = {
  // ----- Knowledge base -----
  fetch_url: {
    name: "fetch_url",
    description: "Fetch a public web page and return its readable text and the fetch timestamp. Used to read org websites and to verify funder pages. Never guess page content.",
    input_schema: { type: "object", properties: { url: { type: "string", format: "uri" } }, required: ["url"] },
  },
  extract_document_text: {
    name: "extract_document_text",
    description: "Return the extracted text of an uploaded document, split by page.",
    input_schema: { type: "object", properties: { document_id: { type: "string" } }, required: ["document_id"] },
  },
  get_org_profile: {
    name: "get_org_profile",
    description: "Return the organization profile: mission, budget, geography, causes, populations, programs.",
    input_schema: { type: "object", properties: { org_id: orgId }, required: ["org_id"] },
  },
  get_facts: {
    name: "get_facts",
    description: "Return the organization's verified facts with their sources. Optionally filter by category.",
    input_schema: { type: "object", properties: { org_id: orgId, category: { type: "string", enum: ["reach", "outcomes", "finance", "organization", "geography", "people"] } }, required: ["org_id"] },
  },
  get_boilerplate: {
    name: "get_boilerplate",
    description: "Return boilerplate text by type (mission, history, program, staff_bio, evaluation, budget_narrative, need_statement).",
    input_schema: { type: "object", properties: { org_id: orgId, type: { type: "string" } }, required: ["org_id"] },
  },
  search_knowledge: {
    name: "search_knowledge",
    description: "Semantic search over the organization's document chunks. Returns passages with document id and page so the draft can cite them.",
    input_schema: { type: "object", properties: { org_id: orgId, query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["org_id", "query"] },
  },
  upsert_fact: {
    name: "upsert_fact",
    description: "Create or update a fact. Must include the source document and excerpt. Facts without a source are rejected.",
    input_schema: {
      type: "object",
      properties: {
        org_id: orgId,
        label: { type: "string" },
        value: { type: "string" },
        category: { type: "string" },
        source_document_id: { type: "string" },
        source_excerpt: { type: "string" },
        source_page: { type: "integer" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["org_id", "label", "value", "category", "source_document_id", "source_excerpt"],
    },
  },
  propose_fact_update: {
    name: "propose_fact_update",
    description: "Propose a new value for an existing fact. Creates an Inbox item; does not change the fact until approved.",
    input_schema: { type: "object", properties: { fact_id: { type: "string" }, proposed_value: { type: "string" }, source_document_id: { type: "string" }, source_excerpt: { type: "string" } }, required: ["fact_id", "proposed_value", "source_document_id", "source_excerpt"] },
  },
  upsert_boilerplate: {
    name: "upsert_boilerplate",
    description: "Create a new version of a boilerplate piece written from the organization's own documents.",
    input_schema: { type: "object", properties: { org_id: orgId, type: { type: "string" }, title: { type: "string" }, body: { type: "string" }, source_document_ids: { type: "array", items: { type: "string" } } }, required: ["org_id", "type", "title", "body", "source_document_ids"] },
  },
  ask_user: {
    name: "ask_user",
    description: "Ask the user a short question during the onboarding interview. Returns their answer.",
    input_schema: { type: "object", properties: { question: { type: "string" }, why: { type: "string" }, suggested_answers: { type: "array", items: { type: "string" } } }, required: ["question"] },
  },

  // ----- Discovery -----
  search_opportunities: {
    name: "search_opportunities",
    description: "Query the opportunity database with hard filters (geography, budget band, org type, deadline window) and a semantic query. Returns candidate opportunities with funder ids. This is the only source of funders; never name a funder that is not returned here.",
    input_schema: {
      type: "object",
      properties: {
        org_id: orgId,
        query: { type: "string" },
        state: { type: "string" },
        min_amount: { type: "number" },
        max_amount: { type: "number" },
        deadline_after: { type: "string", format: "date" },
        deadline_before: { type: "string", format: "date" },
        limit: { type: "integer" },
      },
      required: ["org_id", "query"],
    },
  },
  check_eligibility: {
    name: "check_eligibility",
    description: "Evaluate each eligibility rule of an opportunity against the org profile. Returns pass/fail per rule with the fact used.",
    input_schema: { type: "object", properties: { org_id: orgId, opportunity_id: { type: "string" } }, required: ["org_id", "opportunity_id"] },
  },
  score_fit: {
    name: "score_fit",
    description: "Record a fit score (0 to 100) with plain-language reasons and cautions. Reasons must reference facts or opportunity fields.",
    input_schema: { type: "object", properties: { org_id: orgId, opportunity_id: { type: "string" }, fit_score: { type: "integer", minimum: 0, maximum: 100 }, reasons: { type: "array", items: { type: "string" } }, cautions: { type: "array", items: { type: "string" } } }, required: ["org_id", "opportunity_id", "fit_score", "reasons"] },
  },
  create_match: {
    name: "create_match",
    description: "Persist a match for an eligible opportunity so it appears in Opportunities and the weekly digest.",
    input_schema: { type: "object", properties: { org_id: orgId, opportunity_id: { type: "string" } }, required: ["org_id", "opportunity_id"] },
  },

  // ----- Planner -----
  list_matches: {
    name: "list_matches",
    description: "List current matches with fit score, deadline, amount, and effort.",
    input_schema: { type: "object", properties: { org_id: orgId, min_fit: { type: "integer" } }, required: ["org_id"] },
  },
  list_applications: {
    name: "list_applications",
    description: "List applications with stage and next milestone, so the plan does not double-book the team.",
    input_schema: { type: "object", properties: { org_id: orgId }, required: ["org_id"] },
  },
  estimate_effort: {
    name: "estimate_effort",
    description: "Estimate user hours for an opportunity from its requirements and the org's existing boilerplate coverage.",
    input_schema: { type: "object", properties: { org_id: orgId, opportunity_id: { type: "string" } }, required: ["org_id", "opportunity_id"] },
  },
  create_inbox_item: {
    name: "create_inbox_item",
    description: "Send an agent output to the user's Inbox for approval. Nothing reaches the user any other way.",
    input_schema: { type: "object", properties: { org_id: orgId, agent: { type: "string" }, type: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, payload: { type: "object" }, priority: { type: "string", enum: ["high", "normal"] } }, required: ["org_id", "agent", "type", "title", "summary", "payload"] },
  },

  // ----- Proposal -----
  fetch_guidelines: {
    name: "fetch_guidelines",
    description: "Fetch the funder's guidelines (HTML or PDF) for an opportunity and return the text with page numbers.",
    input_schema: { type: "object", properties: { opportunity_id: { type: "string" } }, required: ["opportunity_id"] },
  },
  parse_requirements: {
    name: "parse_requirements",
    description: "Save the requirements checklist parsed from guidelines: sections with word limits, attachments, format rules, and eligibility.",
    input_schema: {
      type: "object",
      properties: {
        application_id: { type: "string" },
        requirements: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, kind: { type: "string", enum: ["section", "attachment", "format", "eligibility"] }, detail: { type: "string" }, word_limit: { type: "integer" }, required: { type: "boolean" } },
            required: ["title", "kind", "required"],
          },
        },
      },
      required: ["application_id", "requirements"],
    },
  },
  draft_section: {
    name: "draft_section",
    description: "Save a drafted section as HTML. Every factual claim must carry a citation node (data-citation=fact_id). Unknown facts must be gap nodes (data-gap) created with flag_missing_fact, never invented values.",
    input_schema: { type: "object", properties: { application_id: { type: "string" }, requirement_id: { type: "string" }, title: { type: "string" }, body_html: { type: "string" }, citations: { type: "array", items: { type: "object", properties: { fact_id: { type: "string" }, document_id: { type: "string" }, excerpt: { type: "string" } } } } }, required: ["application_id", "title", "body_html", "citations"] },
  },
  flag_missing_fact: {
    name: "flag_missing_fact",
    description: "Record a question for the user when a needed fact is not in the knowledge base. Returns a gap id to place in the draft.",
    input_schema: { type: "object", properties: { application_id: { type: "string" }, section_id: { type: "string" }, question: { type: "string" }, why_it_matters: { type: "string" }, suggested_label: { type: "string" } }, required: ["application_id", "question", "suggested_label"] },
  },
  run_compliance_check: {
    name: "run_compliance_check",
    description: "Check word limits, required sections, attachments, and formatting rules for an application. Returns pass/warn/fail per rule.",
    input_schema: { type: "object", properties: { application_id: { type: "string" } }, required: ["application_id"] },
  },
  revise_text: {
    name: "revise_text",
    description: "Rewrite, shorten, expand, or change the tone of a passage while preserving every citation and gap node exactly.",
    input_schema: { type: "object", properties: { html: { type: "string" }, action: { type: "string", enum: ["rewrite", "shorten", "expand", "tone"] }, tone: { type: "string", enum: ["plain", "warm", "formal", "confident"] }, word_limit: { type: "integer" } }, required: ["html", "action"] },
  },

  // ----- Outreach -----
  get_funder: {
    name: "get_funder",
    description: "Return a funder's profile, AI policy, and recent grantees.",
    input_schema: { type: "object", properties: { funder_id: { type: "string" } }, required: ["funder_id"] },
  },
  get_contacts: {
    name: "get_contacts",
    description: "Return public professional contacts for a funder with the public source of each. No personal addresses.",
    input_schema: { type: "object", properties: { funder_id: { type: "string" } }, required: ["funder_id"] },
  },
  get_application_summary: {
    name: "get_application_summary",
    description: "Return a one-paragraph summary of an application: program, ask, deadline, status.",
    input_schema: { type: "object", properties: { application_id: { type: "string" } }, required: ["application_id"] },
  },
  draft_email: {
    name: "draft_email",
    description: "Save an email draft for the user to send from their own account. The system never sends email.",
    input_schema: { type: "object", properties: { org_id: orgId, application_id: { type: "string" }, funder_id: { type: "string" }, contact_id: { type: "string" }, kind: { type: "string", enum: ["intro", "question", "loi_cover", "thank_you", "follow_up"] }, subject: { type: "string" }, body: { type: "string" } }, required: ["org_id", "funder_id", "kind", "subject", "body"] },
  },

  // ----- Calendar -----
  get_deadline: {
    name: "get_deadline",
    description: "Return the deadline and deadline type for an application's opportunity.",
    input_schema: { type: "object", properties: { application_id: { type: "string" } }, required: ["application_id"] },
  },
  plan_milestones: {
    name: "plan_milestones",
    description: "Propose backward-planned milestones (draft due, budget sign-off, board review, submit) from a deadline, skipping weekends and the org's blackout dates.",
    input_schema: { type: "object", properties: { application_id: { type: "string" }, deadline: { type: "string", format: "date" }, effort: { type: "string", enum: ["low", "medium", "high"] }, needs_board_review: { type: "boolean" } }, required: ["application_id", "deadline", "effort"] },
  },
  create_milestones: {
    name: "create_milestones",
    description: "Persist milestones for an application and schedule email reminders.",
    input_schema: { type: "object", properties: { application_id: { type: "string" }, milestones: { type: "array", items: { type: "object", properties: { title: { type: "string" }, due_date: { type: "string", format: "date" }, kind: { type: "string" }, assignee_id: { type: "string" } }, required: ["title", "due_date", "kind"] } } }, required: ["application_id", "milestones"] },
  },
  schedule_reminder: {
    name: "schedule_reminder",
    description: "Schedule an email reminder N days before a milestone.",
    input_schema: { type: "object", properties: { milestone_id: { type: "string" }, days_before: { type: "integer", minimum: 0, maximum: 30 } }, required: ["milestone_id", "days_before"] },
  },
} satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof tools;

/** Which tools each agent may call. */
export const agentToolsets: Record<string, ToolName[]> = {
  profile: ["fetch_url", "extract_document_text", "get_facts", "upsert_fact", "propose_fact_update", "upsert_boilerplate", "ask_user"],
  discovery: ["get_org_profile", "get_facts", "search_opportunities", "check_eligibility", "fetch_url", "score_fit", "create_match"],
  planner: ["list_matches", "list_applications", "estimate_effort", "create_inbox_item"],
  proposal: ["fetch_guidelines", "parse_requirements", "get_facts", "get_boilerplate", "search_knowledge", "draft_section", "flag_missing_fact", "run_compliance_check", "revise_text"],
  outreach: ["get_funder", "get_contacts", "get_application_summary", "draft_email"],
  calendar: ["get_deadline", "plan_milestones", "create_milestones", "schedule_reminder"],
};

export function toolsFor(agent: keyof typeof agentToolsets): ToolDefinition[] {
  return agentToolsets[agent].map((n) => tools[n]);
}
