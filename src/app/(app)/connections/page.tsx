import type { Metadata } from "next";
import { services } from "@/lib/services";
import { ConnectionsView } from "./connections-view";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const [contacts, applications, runtime] = await Promise.all([services.contacts.list(), services.applications.list(), services.loop.runtime()]);
  return <ConnectionsView contacts={contacts} applications={applications} demo={runtime.demo && !runtime.ai} />;
}
