// Console feature flags and their safe defaults, gating the rollout of major surfaces. Keep the
// list small.
export type FeatureFlag = "qeetai" | "authorization-builder" | "risk-engine" | "new-dashboard";

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  qeetai: true,
  "authorization-builder": true,
  "risk-engine": false,
  "new-dashboard": false,
};
