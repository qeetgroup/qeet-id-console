import { createContext, type ReactNode, useContext, useMemo } from "react";

import { evaluateFlags } from "@/platform/feature-flags/evaluation";
import type { FeatureFlag } from "@/platform/feature-flags/flags";

const FeatureFlagContext = createContext<Record<FeatureFlag, boolean> | null>(null);

/** Provides the resolved flag map. Optional — the hook falls back to a direct
 *  evaluation if no provider is mounted, so flags work anywhere. */
export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = useMemo(() => evaluateFlags(), []);
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

/** Read a single feature flag. */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const flags = useContext(FeatureFlagContext);
  return (flags ?? evaluateFlags())[flag];
}
