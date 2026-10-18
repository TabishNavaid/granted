import type { Metadata } from "next";
import { services } from "@/lib/services";
import type { InboxContext } from "@/components/app/inbox-item";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [items, matches, user, milestones, facts, documents, applications] = await Promise.all([
    services.inbox.list(),
    services.opportunities.listMatches(),
    services.org.currentUser(),
    services.calendar.listMilestones(),
    services.knowledge.listFacts(),
    services.knowledge.listDocuments(),
    services.applications.list(),
  ]);

  const planItem = items.find((i) => i.type === "monthly_plan" && i.status === "pending");
  const plan = planItem && planItem.payload.type === "monthly_plan" ? await services.inbox.getPlan(planItem.payload.planId) : null;

  const emailIds = items.flatMap((i) => (i.payload.type === "email_draft" ? [i.payload.emailDraftId] : []));
  const emails = await Promise.all(emailIds.map((id) => services.inbox.getEmailDraft(id)));
  const missingIds = items.flatMap((i) => (i.payload.type === "missing_facts" ? i.payload.missingFactIds : []));
  const workspaces = await Promise.all(
    Array.from(new Set(items.flatMap((i) => (i.payload.type === "missing_facts" ? [i.payload.applicationId] : [])))).map((id) => services.applications.getWorkspace(id)),
  );

  const ctx: InboxContext = {
    matches: Object.fromEntries(matches.map((m) => [m.id, m])),
    emails: Object.fromEntries(emails.flatMap((e) => (e ? [[e.id, e]] : []))),
    milestones: Object.fromEntries(milestones.map((m) => [m.id, m])),
    missingFacts: Object.fromEntries(workspaces.flatMap((w) => (w ? w.missingFacts.filter((m) => missingIds.includes(m.id)).map((m) => [m.id, m]) : []))),
    facts: Object.fromEntries(facts.map((f) => [f.id, f])),
    documents: Object.fromEntries(documents.map((d) => [d.id, d])),
    funderNames: Object.fromEntries(matches.map((m) => [m.funder.id, m.funder.name]).concat(applications.map((a) => [a.funder.id, a.funder.name]))),
    applicationTitles: Object.fromEntries(applications.map((a) => [a.id, `${a.funder.name}: ${a.opportunity.title}`])),
  };

  return <InboxView items={items} plan={plan} planItemId={planItem?.id ?? null} ctx={ctx} firstName={user.fullName.split(" ")[0]} />;
}
