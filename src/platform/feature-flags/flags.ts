// Catalogue of console feature flags + their safe defaults. Flags gate the
// gradual rollout of major surfaces (new authorization builder, Qeet AI, risk
// engine, new dashboard) without hard-coding availability across components.
// Keep this list small and intentional.
export type FeatureFlag = "qeetai" | "authorization-builder" | "risk-engine" | "new-dashboard";

export const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  qeetai: true,
  "authorization-builder": true,
  "risk-engine": false,
  "new-dashboard": false,
};
