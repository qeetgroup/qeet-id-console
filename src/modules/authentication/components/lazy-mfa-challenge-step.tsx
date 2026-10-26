import { Spinner } from "@qeetrix/react";
import { lazy, Suspense } from "react";

import type { MfaChallenge } from "../api/flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";

// The second-factor step (code slots, authenticator setup, recovery codes) is for only some
// sign-ins, and only after the first factor, so it loads apart from the entry pages.
const load = () => import("./mfa-challenge-step");
const Step = lazy(() => load().then((m) => ({ default: m.MfaChallengeStep })));

/**
 * Starts loading the step as the first factor is sent, so it's there when a challenge comes back.
 * A failure is left for the step itself to meet.
 */
export function preloadMfaChallengeStep() {
  load().catch(() => {});
}

/** Renders MfaChallengeStep, behind the same entry frame while it loads. */
export function LazyMfaChallengeStep({ challenge }: { challenge: MfaChallenge }) {
  const steps = useEntrySteps();
  const loading = (
    <EntryShell panel={<EntryPanel steps={steps.confirm} current={1} />}>
      <div className="entry-waiting" role="status">
        <Spinner size="lg" />
      </div>
    </EntryShell>
  );
  return (
    <Suspense fallback={loading}>
      <Step challenge={challenge} />
    </Suspense>
  );
}
