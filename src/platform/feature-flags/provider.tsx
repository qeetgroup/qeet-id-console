import { createContext, type ReactNode, useContext, useMemo } from "react";

import { evaluateFlags } from "@/platform/feature-flags/evaluation";

const FeatureFlagContext = createContext<Record<string, boolean> | null>(null);

/** Provides the resolved flags. Optional: without it, useFeatureFlag evaluates them directly. */
export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = useMemo(() => evaluateFlags(), []);
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

/** Returns whether a flag a module declares is on; an undeclared flag is off. */
export function useFeatureFlag(flag: string): boolean {
  const flags = useContext(FeatureFlagContext);
  return (flags ?? evaluateFlags())[flag] ?? false;
}
