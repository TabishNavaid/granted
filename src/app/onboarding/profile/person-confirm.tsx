"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PersonProfile } from "@/lib/types";
import { services } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { PersonProfilePanel } from "@/components/segments/person-panel";

/** A person checks what we read from their résumé before anything uses it. */
export function PersonConfirmStep({ profile }: { profile: PersonProfile | null }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  return (
    <div>
      <h1 className="font-display text-h1 text-ink">Does this look right?</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-muted">This is everything an essay may say about you. Fix anything that is off, and fill in your state, level, and field so we can match scholarships. Save your changes before you continue.</p>
      <div className="mt-8">
        <PersonProfilePanel profile={profile} readOnly={false} />
      </div>
      <Button
        size="lg"
        className="mt-10"
        loading={loading}
        disabled={!profile}
        onClick={async () => {
          setLoading(true);
          await services.org.update({ onboardingStep: "gaps" });
          router.push("/onboarding/matches");
        }}
      >
        Looks right, find scholarships
      </Button>
    </div>
  );
}
