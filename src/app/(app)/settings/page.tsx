import type { Metadata } from "next";
import { services } from "@/lib/services";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [org, members, subscription, invoices, notifications] = await Promise.all([
    services.org.get(),
    services.org.listMembers(),
    services.billing.getSubscription(),
    services.billing.listInvoices(),
    services.billing.getNotificationSettings(),
  ]);
  return <SettingsView org={org} members={members} subscription={subscription} invoices={invoices} notifications={notifications} initialTab={tab} />;
}
