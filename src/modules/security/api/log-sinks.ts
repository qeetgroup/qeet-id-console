// Sinks that forward the tenant's audit events to a SIEM. A sink's token is write-only: it is
// sent on create and never returned.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { isOneOf } from "@/shared/utils/one-of";
import { securityKeys } from "./keys";

const SINK_TYPES = ["splunk_hec", "datadog", "http"] as const;
export type SinkType = (typeof SINK_TYPES)[number];

export type LogSink = NonNullable<
  Answer<"/v1/organizations/{organizationID}/log-sinks">["items"]
>[number];

/** A sink's type as the console knows it; the document leaves it a free string. */
export const sinkType = (type: string): SinkType | undefined =>
  isOneOf(SINK_TYPES, type) ? type : undefined;

export function useLogSinks() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.logSinks(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/log-sinks", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
  });
}

export function useCreateLogSink() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: SinkType; endpoint: string; token: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/log-sinks", {
        path: { organizationID: organizationId },
        body,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.logSinks(organizationId) }),
    meta: { successMessage: "security:toast.logSinkAdded", silentError: true }, // the form shows it
  });
}

export function useToggleLogSink() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.patch("/v1/organizations/{organizationID}/log-sinks/{id}", {
        path: { organizationID: organizationId, id },
        body: { enabled },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.logSinks(organizationId) }),
    meta: { successMessage: "security:toast.logSinkUpdated" },
  });
}

export function useDeleteLogSink() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.delete("/v1/organizations/{organizationID}/log-sinks/{id}", {
        path: { organizationID: organizationId, id },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.logSinks(organizationId) }),
    meta: { successMessage: "security:toast.logSinkDeleted" },
  });
}
