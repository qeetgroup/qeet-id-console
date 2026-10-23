import { readPublicConfig } from "@/platform/config/public-config";
import { flagDefinitions } from "@/platform/modules/registry";

/**
 * Returns whether each flag the modules declare is on: its build default, unless the deployment
 * turned it off at runtime (CONSOLE_FLAGS_OFF), which needs no new build.
 */
export function evaluateFlags(
  off: readonly string[] = readPublicConfig().flagsOff ?? [],
): Record<string, boolean> {
  return Object.fromEntries(flagDefinitions().map((f) => [f.id, f.enabled && !off.includes(f.id)]));
}
