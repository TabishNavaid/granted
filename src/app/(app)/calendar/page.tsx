import type { Metadata } from "next";
import { services } from "@/lib/services";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const [events, apps, settings, members, icsUrl] = await Promise.all([services.calendar.listEvents(), services.applications.list(), services.billing.getNotificationSettings(), services.org.listMembers(), services.calendar.icsUrl()]);
  return <CalendarView initial={events} applications={apps} reminderDays={settings.reminderDaysBefore} members={members} icsUrl={icsUrl} />;
}
