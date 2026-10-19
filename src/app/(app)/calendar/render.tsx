import { services } from "@/lib/services";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const [events, apps, settings, members, icsUrl, matches, outbox] = await Promise.all([
    services.calendar.listEvents(),
    services.applications.list(),
    services.billing.getNotificationSettings(),
    services.org.listMembers(),
    services.calendar.icsUrl(),
    services.opportunities.listMatches(),
    services.calendar.reminderOutbox(),
  ]);
  const applied = new Set(apps.map((a) => a.opportunityId));
  // Deadlines of matched funders not applied to yet, for the year plan.
  const openDeadlines = matches
    .filter((m) => m.status !== "dismissed" && !applied.has(m.opportunityId) && m.opportunity.deadline && m.opportunity.deadlineType !== "rolling")
    .map((m) => ({ opportunityId: m.opportunityId, date: m.opportunity.deadline!, title: m.opportunity.title, funderId: m.funder.id, funderName: m.funder.name, fitScore: m.fitScore, loi: m.opportunity.deadlineType === "loi" }));
  const initialView = view === "year" || view === "list" ? view : "month";
  return (
    <CalendarView
      initial={events}
      applications={apps}
      reminderDays={settings.reminderDaysBefore}
      remindersOn={settings.milestoneReminders}
      members={members}
      icsUrl={icsUrl}
      openDeadlines={openDeadlines}
      outbox={outbox}
      initialView={initialView}
    />
  );
}
