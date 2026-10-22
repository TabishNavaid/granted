/**
 * Every external service the product can use, with whether its key is present.
 * The /settings/integrations page renders this list; adapters check the same
 * `present` flags before doing anything.
 */
export type IntegrationId = "gemini" | "supabase" | "google_auth" | "gmail" | "outlook" | "google_calendar" | "email" | "sam_gov";

export interface IntegrationStatus {
  id: IntegrationId;
  name: string;
  required: boolean;
  present: boolean;
  /** What having it turns on, in the user's words. */
  unlocks: string;
  /** The env var names it reads. */
  envVars: string[];
  /** Where to get it, one sentence. */
  howTo: string;
  docsUrl: string;
}

const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]?.trim()));

export function integrationStatus(): IntegrationStatus[] {
  return [
    { id: "gemini", name: "Google Gemini", required: true, present: has("GEMINI_API_KEY"), unlocks: "Reading your website, matching, drafting, and every other agent.", envVars: ["GEMINI_API_KEY"], howTo: "Create a key in Google AI Studio.", docsUrl: "https://aistudio.google.com/apikey" },
    { id: "supabase", name: "Supabase", required: true, present: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"), unlocks: "Sign-in, saved work, and your team.", envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], howTo: "Create a project, run every migration in supabase/migrations in order, copy the API keys.", docsUrl: "https://supabase.com/dashboard" },
    { id: "google_auth", name: "Google sign-in", required: false, present: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), unlocks: "Sign in with a Google account instead of an email link.", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], howTo: "Create an OAuth client in Google Cloud and enable the Google provider in Supabase Auth.", docsUrl: "https://supabase.com/docs/guides/auth/social-login/auth-google" },
    { id: "gmail", name: "Gmail", required: false, present: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), unlocks: "Send approved funder emails from your own Gmail address.", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], howTo: "Same OAuth client as Google sign-in, with the Gmail send scope enabled.", docsUrl: "https://developers.google.com/gmail/api/guides/sending" },
    { id: "outlook", name: "Outlook", required: false, present: has("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"), unlocks: "Send approved funder emails from your own Outlook address.", envVars: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"], howTo: "Register an app in Microsoft Entra with the Mail.Send permission.", docsUrl: "https://learn.microsoft.com/graph/api/user-sendmail" },
    { id: "google_calendar", name: "Google Calendar", required: false, present: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), unlocks: "Push deadlines and milestones to your Google Calendar.", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], howTo: "Same OAuth client, with the Calendar events scope enabled.", docsUrl: "https://developers.google.com/calendar/api/guides/overview" },
    { id: "email", name: "Email delivery (Resend)", required: false, present: has("RESEND_API_KEY"), unlocks: "The weekly digest and the contact form. Milestone reminder emails are not scheduled yet.", envVars: ["RESEND_API_KEY", "EMAIL_FROM"], howTo: "Create an API key at Resend and verify your sending domain.", docsUrl: "https://resend.com/docs" },
    { id: "sam_gov", name: "SAM.gov contract opportunities", required: false, present: has("SAM_GOV_API_KEY"), unlocks: "Federal contract opportunities for a firm's NAICS codes, with a fit score. Adding an RFP you have works without it.", envVars: ["SAM_GOV_API_KEY"], howTo: "Sign in at SAM.gov, open your Workspace, then Profile, then Public API Key, and request a key. It is free; the public key allows a limited number of requests a day.", docsUrl: "https://open.gsa.gov/api/get-opportunities-public-api/" },
  ];
}

export function isConnected(id: IntegrationId): boolean {
  return integrationStatus().find((i) => i.id === id)?.present ?? false;
}
