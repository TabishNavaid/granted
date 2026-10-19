import { redirect } from "next/navigation";
import { browserDemoFlag } from "@/lib/demo/server";
import { OpenSample } from "@/components/demo/open-sample";

export const dynamic = "force-dynamic";

/** The browser demo's half of /api/demo/open: the sample is opened in this browser, where the workspaces live. */
export default async function OpenSamplePage({ searchParams }: { searchParams: Promise<{ sample?: string; next?: string }> }) {
  const { sample = "", next: raw = "/inbox" } = await searchParams;
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/inbox";
  const flag = browserDemoFlag();
  if (!flag) redirect(`/api/demo/open?sample=${encodeURIComponent(sample)}&next=${encodeURIComponent(next)}`);
  return <OpenSample flag={flag} sample={sample} next={next} />;
}
