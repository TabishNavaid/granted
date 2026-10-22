import type { Metadata } from "next";
import { PageIntro } from "@/components/marketing/page-intro";
import { MAIL_CATEGORIES, readUnsubscribeToken } from "@/lib/email/unsubscribe";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const who = readUnsubscribeToken(t);
  if (!who) return <PageIntro title="That link did not work." lead="It may have been cut off when it was copied. Open the latest email and use its unsubscribe link, or turn emails off in Settings." />;
  return (
    <PageIntro title={`Stop ${MAIL_CATEGORIES[who.category]}?`} lead={`${who.email} will no longer get ${MAIL_CATEGORIES[who.category]} from this workspace. Sign-in links and invitations still arrive.`}>
      <UnsubscribeButton token={t} />
    </PageIntro>
  );
}
