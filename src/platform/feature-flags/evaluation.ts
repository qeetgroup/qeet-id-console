import { env } from "@/platform/config/env";
import { DEFAULT_FLAGS, type FeatureFlag } from "@/platform/feature-flags/flags";

/** Returns the effective flags: the defaults with build-time overrides applied. */
export function evaluateFlags(): Record<FeatureFlag, boolean> {
  return {
    ...DEFAULT_FLAGS,
    qeetai: env.VITE_QEETAI_ENABLED !== "false", // build-time kill switch, for air-gapped builds
  };
}
