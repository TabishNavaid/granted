import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <ComingSoon
      title="Connections"
      description="Find the people on your board and in your network who already know your funders."
      bullets={[
        "Map program officers, trustees, and staff at each funder from public sources.",
        "Upload your board list and see who overlaps with a funder's board.",
        "Get an intro email drafted for the board member to send.",
      ]}
    />
  );
}
