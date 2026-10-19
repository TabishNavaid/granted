import { services } from "@/lib/services";
import { OutreachView } from "./outreach-view";

export default async function OutreachPage() {
  const [emails, applications, contacts, connections, runtime] = await Promise.all([
    services.outreach.list(),
    services.applications.list(),
    services.contacts.list(),
    services.integrations.connections(),
    services.loop.runtime(),
  ]);
  return <OutreachView emails={emails} applications={applications} contacts={contacts} connections={connections} demo={runtime.demo && !runtime.ai} />;
}
