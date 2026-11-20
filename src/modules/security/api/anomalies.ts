// Sign-in attacks the server's lockout detects (credential stuffing, password spraying). The
// one change, resolving one, is in anomaly-actions.ts: only its page uses it.

import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

// `metadata` holds the detection's own facts: `counter` (which count tripped: "source", "account"
// or "account_network"), `failures`, `distinct_accounts`, `window_minutes`, `network`,
// `locked_until` or `throttled_until`. Any may be missing.
export type Anomaly =
  Answer<"/v1/organizations/{organizationID}/security/anomalies">["items"][number];

// The pages show the newest detections: one page, the most the server sends at once.
const RECENT = 200;

/**
 * Whether an anomaly is resolved. Until then it is open, whatever its status says: the sign-in
 * lockout's detections record theirs as "rate-limited".
 */
export function isAnomalyResolved(anomaly: Pick<Anomaly, "status" | "resolved_at">): boolean {
  return !!anomaly.resolved_at || anomaly.status === "resolved";
}

export interface AnomalySummary {
  open: number;
  resolved_24h: number;
  affected_accounts: number;
  high_severity_24h: number;
}

export function useAnomalies(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.anomalyList(organizationId),
    queryFn: async (): Promise<{ items: Anomaly[] }> => {
      try {
        return await backend.get("/v1/organizations/{organizationID}/security/anomalies", {
          path: { organizationID: organizationId ?? "" },
          query: { limit: RECENT },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { items: [] };
        throw err;
      }
    },
    enabled: enabled && !!organizationId,
    staleTime: 30_000,
  });
}

export function useAnomalySummary() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.anomalySummary(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/security/anomalies/summary", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}
