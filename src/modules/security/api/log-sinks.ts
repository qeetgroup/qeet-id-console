// Sinks that forward the tenant's audit events to a SIEM. A sink's token is write-only: it is
// sent on create and never returned.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export type SinkType = "splunk_hec" | "datadog" | "http";

export interface LogSink {
  id: string;
  type: SinkType;
  endpoint: string;
  enabled: boolean;
  last_forwarded_at?: string | null;
  last_error?: string;
  created_at: string;
}

const KEY = ["log-sinks"];

export function useLogSinks() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...KEY, tenantId],
    queryFn: () => api<{ items: LogSink[] }>(`/v1/tenants/${tenantId}/log-sinks`),
    enabled: !!tenantId,
  });
}

export function useCreateLogSink() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: SinkType; endpoint: string; token: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<LogSink>(`/v1/tenants/${tenantId}/log-sinks`, {
        method: "POST",
        body,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Log sink added" },
  });
}

export function useToggleLogSink() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/log-sinks/${id}`, {
        method: "PATCH",
        body: { enabled },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Log sink updated" },
  });
}

export function useDeleteLogSink() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/log-sinks/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: "Log sink deleted" },
  });
}
