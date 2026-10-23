// Departures from each actor's usual behaviour in the hash-chained audit log; the sign-in
// anomalies in anomalies.ts are a separate feed.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export type AnomalyReason = "new_action_type" | "unusual_hour" | "new_ip";

export interface AuditAnomaly {
  id: string;
  tenant_id: string;
  event_id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  score: number;
  reasons: AnomalyReason[];
  status: "open" | "resolved";
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
  action: string;
  resource_type: string;
  ip?: string | null;
  event_at: string;
}

export interface AuditAnomalySummary {
  open: number;
  resolved_7d: number;
  high_score_open: number;
}

export interface AuditAnomalySettings {
  tenant_id: string;
  enabled: boolean;
  score_threshold: number;
  min_baseline_events: number;
}

export function useAuditAnomalies(status?: "open" | "resolved") {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditAnomalyList(tenantId, status ?? "all"),
    queryFn: () =>
      api<{ items: AuditAnomaly[] }>(`/v1/tenants/${tenantId}/audit/anomalies`, {
        query: status ? { status } : undefined,
      }),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useAuditAnomalySummary() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditAnomalySummary(tenantId),
    queryFn: () => api<AuditAnomalySummary>(`/v1/tenants/${tenantId}/audit/anomalies/summary`),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useResolveAuditAnomaly() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/audit/anomalies/${id}/resolve`, {
        method: "POST",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.auditAnomalies(tenantId) }),
    meta: { successMessage: "Anomaly resolved" },
  });
}

export function useAuditAnomalySettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditAnomalySettings(tenantId),
    queryFn: () => api<AuditAnomalySettings>(`/v1/tenants/${tenantId}/audit/anomaly-settings`),
    enabled: !!tenantId,
  });
}

export function useUpdateAuditAnomalySettings() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<AuditAnomalySettings, "tenant_id">) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<AuditAnomalySettings>(`/v1/tenants/${tenantId}/audit/anomaly-settings`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: securityKeys.auditAnomalySettings(tenantId) }),
    meta: { successMessage: "Anomaly-detection settings updated", silentError: true }, // the form shows it
  });
}

export function useVerifyAuditChain() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{
        ok: boolean;
        rows_checked: number;
        last_verified_id?: string;
        broken_at_id?: string;
        broken_reason?: string;
      }>(`/v1/tenants/${tenantId}/audit/verify`);
    },
    meta: { silent: true },
  });
}
