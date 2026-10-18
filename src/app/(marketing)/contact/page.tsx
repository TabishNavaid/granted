import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { contactAddress, emailConnected } from "@/lib/integrations/email";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact", description: "Write to the people building it.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const address = contactAddress();
  return (
    <>
      <PageIntro title="Write to us." lead="A question, a problem, or an organization that should try this first. A person reads every message." />
      <section className="mx-auto max-w-[75rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <ContactForm canSend={emailConnected() && Boolean(address)} address={address} />
      </section>
    </>
  );
}
