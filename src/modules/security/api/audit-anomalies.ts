// Departures from each actor's usual behaviour in the hash-chained audit log; the sign-in
// anomalies in anomalies.ts are a separate feed.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { assured, assuredItems } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer, Body } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export type AnomalyReason = "new_action_type" | "unusual_hour" | "new_ip";

// The server always sends these (internal/operations/audit/anomaly/anomaly.go); the document marks
// them optional.
const auditAnomalyPage = assuredItems<
  Answer<"/v1/organizations/{organizationID}/audit/anomalies">
>()(
  "id",
  "organization_id",
  "event_id",
  "score",
  "reasons",
  "status",
  "created_at",
  "action",
  "resource_type",
  "event_at",
);
export type AuditAnomaly = z.infer<typeof auditAnomalyPage>["items"][number];

export type AuditAnomalySummary =
  Answer<"/v1/organizations/{organizationID}/audit/anomalies/summary">;

const SETTINGS_PATH = "/v1/organizations/{organizationID}/audit/anomaly-settings";
const anomalySettings = assured<Answer<typeof SETTINGS_PATH>>()(
  "enabled",
  "score_threshold",
  "min_baseline_events",
);
export type AuditAnomalySettings = z.infer<typeof anomalySettings>;

/** The latest flags, newest first: 50 unless `limit` says otherwise (the server takes up to 200). */
export function useAuditAnomalies(status?: "open" | "resolved", limit?: number) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: [...securityKeys.auditAnomalyList(organizationId, status ?? "all"), limit ?? 50],
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/audit/anomalies", {
        path: { organizationID: organizationId ?? "" },
        query: status || limit ? { status, limit } : undefined,
        schema: auditAnomalyPage,
      }),
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useAuditAnomalySummary() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.auditAnomalySummary(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/audit/anomalies/summary", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useResolveAuditAnomaly() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/audit/anomalies/{id}/resolve", {
        path: { organizationID: organizationId, id },
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: securityKeys.auditAnomalies(organizationId) }),
    meta: { successMessage: "security:toast.anomalyResolved" },
  });
}

export function useAuditAnomalySettings() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.auditAnomalySettings(organizationId),
    queryFn: () =>
      backend.get(SETTINGS_PATH, {
        path: { organizationID: organizationId ?? "" },
        schema: anomalySettings,
      }),
    enabled: !!organizationId,
  });
}

export function useUpdateAuditAnomalySettings() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Body<typeof SETTINGS_PATH, "put">) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.put("/v1/organizations/{organizationID}/audit/anomaly-settings", {
        path: { organizationID: organizationId },
        body,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: securityKeys.auditAnomalySettings(organizationId) }),
    meta: { successMessage: "security:toast.anomalySettingsUpdated", silentError: true }, // the form shows it
  });
}

export function useVerifyAuditChain() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.get("/v1/organizations/{organizationID}/audit/verify", {
        path: { organizationID: organizationId },
      });
    },
    meta: { silent: true },
  });
}
