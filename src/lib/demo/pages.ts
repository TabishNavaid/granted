import type { ReactNode } from "react";

/**
 * Every page that reads demo state, by name. Each `render` module holds the
 * page's body: on a server it runs as the page, and in the browser demo the
 * same function runs in the tab against the visitor's saved state (see
 * src/components/demo/demo-page.tsx).
 */
type RenderModule = { default: (props: { params: Promise<never>; searchParams: Promise<never> }) => Promise<ReactNode> | ReactNode };

export const DEMO_PAGES = {
  inbox: () => import("@/app/(app)/inbox/render"),
  opportunities: () => import("@/app/(app)/opportunities/render"),
  opportunity: () => import("@/app/(app)/opportunities/[id]/render"),
  application: () => import("@/app/(app)/applications/[id]/render"),
  draft: () => import("@/app/(app)/applications/[id]/draft/render"),
  pipeline: () => import("@/app/(app)/pipeline/render"),
  calendar: () => import("@/app/(app)/calendar/render"),
  outreach: () => import("@/app/(app)/outreach/render"),
  profile: () => import("@/app/(app)/profile/render"),
  activity: () => import("@/app/(app)/activity/render"),
  settings: () => import("@/app/(app)/settings/render"),
  integrations: () => import("@/app/(app)/settings/integrations/render"),
  connections: () => import("@/app/(app)/connections/render"),
  social: () => import("@/app/(app)/social/render"),
  analytics: () => import("@/app/(app)/analytics/render"),
  funders: () => import("@/app/(app)/funders/render"),
  funder: () => import("@/app/(app)/funders/[id]/render"),
  scholarships: () => import("@/app/(app)/scholarships/render"),
  onboarding: () => import("@/app/onboarding/render"),
  onboardingEin: () => import("@/app/onboarding/ein/render"),
  onboardingReading: () => import("@/app/onboarding/reading/render"),
  onboardingProfile: () => import("@/app/onboarding/profile/render"),
  onboardingGaps: () => import("@/app/onboarding/gaps/render"),
  onboardingMatches: () => import("@/app/onboarding/matches/render"),
} satisfies Record<string, () => Promise<RenderModule>>;

export type DemoRoute = keyof typeof DEMO_PAGES;

export type DemoParams = Record<string, string | string[] | undefined>;
