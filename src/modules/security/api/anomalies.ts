// Sign-in attacks the server's lockout detects (credential stuffing, password spraying). The
// one change, resolving one, is in anomaly-actions.ts: only its page uses it.

import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface Anomaly {
  id: string;
  type: string;
  severity: string;
  detail: string;
  status: string;
  user_id?: string | null;
  user_email?: string | null;
  ip?: string | null;
  /**
   * The detection's own facts: `counter` (which count tripped: "source", "account" or
   * "account_network"), `failures`, `distinct_accounts`, `window_minutes`, `network`,
   * `locked_until` or `throttled_until`. Any may be missing.
   */
  metadata?: Record<string, unknown> | null;
  created_at: string;
  resolved_at?: string | null;
}

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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.anomalyList(tenantId),
    queryFn: async (): Promise<{ items: Anomaly[] }> => {
      try {
        return await api<{ items: Anomaly[] }>(`/v1/tenants/${tenantId}/security/anomalies`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { items: [] };
        throw err;
      }
    },
    enabled: enabled && !!tenantId,
    staleTime: 30_000,
  });
}

export function useAnomalySummary() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.anomalySummary(tenantId),
    queryFn: () => api<AnomalySummary>(`/v1/tenants/${tenantId}/security/anomalies/summary`),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}
