import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Social" };

export default function SocialPage() {
  return (
    <ComingSoon
      title="Social"
      description="Posts timed to your applications, so when a funder looks you up, they see a program with momentum."
      bullets={[
        "A monthly content calendar built from your programs, wins, and upcoming applications.",
        "Posts drafted per platform in your own voice, ready to approve in the Inbox.",
        "A credibility campaign in the two weeks before each big submission.",
      ]}
    />
  );
}
