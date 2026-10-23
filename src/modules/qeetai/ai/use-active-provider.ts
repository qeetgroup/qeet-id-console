import { useMemo } from "react";

import { useQeetAIStatus } from "../api/qeetai";

import type { AIProvider } from "./ai-provider";
import { backendProvider } from "./backend-provider";
import { unconfiguredProvider } from "./unconfigured-provider";

/** Returns the backend provider when the status endpoint reports Qeet AI usable, else the stub. */
export function useActiveProvider(): AIProvider {
  const status = useQeetAIStatus();
  // `available` also needs a plan that includes Qeet AI; servers that omit it send `configured`.
  const usable = status.data?.available ?? status.data?.configured;
  return useMemo(() => (usable ? backendProvider : unconfiguredProvider), [usable]);
}
