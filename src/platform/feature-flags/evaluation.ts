import { env } from "@/platform/config/env";
import { DEFAULT_FLAGS, type FeatureFlag } from "@/platform/feature-flags/flags";

// Resolve the effective flag map. Starts from defaults and applies known
// build-time overrides. This is where a remote flag service would merge in
// later — behind the same map, so callers never change.
export function evaluateFlags(): Record<FeatureFlag, boolean> {
  return {
    ...DEFAULT_FLAGS,
    // Build-time kill switch already honoured by the shell (air-gapped builds).
    qeetai: env.VITE_QEETAI_ENABLED !== "false",
  };
}
