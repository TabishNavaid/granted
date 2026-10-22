import { services } from "@/lib/services";
import { SettingsView } from "./settings-view";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [org, members, usage, notifications, icsUrl, user, autonomy, outbox, demo] = await Promise.all([
    services.org.get(),
    services.org.listMembers(),
    services.account.getUsage(),
    services.account.getNotificationSettings(),
    services.calendar.icsUrl(),
    services.org.currentUser(),
    services.org.getAutonomy(),
    services.calendar.reminderOutbox(),
    services.demo.status(),
  ]);
  return (
    <SettingsView
      org={org}
      members={members}
      usage={usage}
      notifications={notifications}
      initialTab={tab}
      icsUrl={icsUrl}
      currentUserId={user.id}
      currentRole={user.role}
      autonomy={autonomy}
      outbox={outbox}
      demo={demo.active}
    />
  );
}
