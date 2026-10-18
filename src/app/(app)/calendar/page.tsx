import type { Metadata } from "next";
import { services } from "@/lib/services";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const [events, apps, settings] = await Promise.all([services.calendar.listEvents(), services.applications.list(), services.billing.getNotificationSettings()]);
  return <CalendarView initial={events} applications={apps} reminderDays={settings.reminderDaysBefore} />;
}
