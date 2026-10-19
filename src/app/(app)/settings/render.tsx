import { services } from "@/lib/services";
import { SettingsView } from "./settings-view";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [org, members, subscription, invoices, notifications, integrations, icsUrl, user, autonomy, outbox, demo] = await Promise.all([
    services.org.get(),
    services.org.listMembers(),
    services.billing.getSubscription(),
    services.billing.listInvoices(),
    services.billing.getNotificationSettings(),
    services.integrations.status(),
    services.calendar.icsUrl(),
    services.org.currentUser(),
    services.org.getAutonomy(),
    services.calendar.reminderOutbox(),
    services.demo.status(),
  ]);
  const stripe = integrations.find((i) => i.id === "stripe")?.present ?? false;
  return (
    <SettingsView
      org={org}
      members={members}
      subscription={subscription}
      invoices={invoices}
      notifications={notifications}
      initialTab={tab}
      stripe={stripe}
      icsUrl={icsUrl}
      currentUserId={user.id}
      currentRole={user.role}
      autonomy={autonomy}
      outbox={outbox}
      demo={demo.active}
    />
  );
}
