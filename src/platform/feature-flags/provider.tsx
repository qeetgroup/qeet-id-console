import { createContext, type ReactNode, useContext, useMemo } from "react";

import { evaluateFlags } from "@/platform/feature-flags/evaluation";
import type { FeatureFlag } from "@/platform/feature-flags/flags";

const FeatureFlagContext = createContext<Record<FeatureFlag, boolean> | null>(null);

/** Provides the resolved flags. Optional: without it, useFeatureFlag evaluates them directly. */
export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = useMemo(() => evaluateFlags(), []);
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const flags = useContext(FeatureFlagContext);
  return (flags ?? evaluateFlags())[flag];
}
