// Outbound webhooks: the tenant's endpoints, their delivery log, and test or retried deliveries.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { developerKeys } from "./keys";

export interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  secret?: string; // the signing secret, only in the create response
  events: string[];
  disabled_at?: string | null;
  created_at: string;
}

/** One attempt to deliver an event; `error` and `response_body` come from the receiving endpoint. */
export interface WebhookDelivery {
  id: string;
  event_type: string;
  attempt: number;
  status_code?: number | null;
  error?: string | null;
  payload: string;
  response_body?: string | null;
  next_attempt_at?: string | null;
  delivered_at?: string | null;
  dead_at?: string | null;
  created_at: string;
}

export const webhookQueries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: developerKeys.webhooks(tenantId),
      queryFn: () => api<{ items: Webhook[] }>(`/v1/tenants/${tenantId}/webhooks`),
      enabled: !!tenantId,
    }),
  detail: (tenantId: string | null, id: string) =>
    queryOptions({
      queryKey: [...developerKeys.webhook(tenantId, id), "detail"],
      queryFn: () => api<Webhook>(`/v1/webhooks/${id}`),
      enabled: !!tenantId && !!id,
    }),
  deliveries: (tenantId: string | null, id: string) =>
    queryOptions({
      queryKey: [...developerKeys.webhook(tenantId, id), "deliveries"],
      queryFn: () => api<{ items: WebhookDelivery[] }>(`/v1/webhooks/${id}/deliveries`),
      enabled: !!tenantId && !!id,
      retry: false,
      meta: { silent: true }, // the page shows the log's own empty and error states
    }),
};

export function useWebhooks() {
  return useQuery(webhookQueries.list(useTenantId()));
}

export function useWebhook(id: string) {
  return useQuery(webhookQueries.detail(useTenantId(), id));
}

export function useWebhookDeliveries(id: string) {
  return useQuery(webhookQueries.deliveries(useTenantId(), id));
}

export function useCreateWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { tenant_id: string; url: string; events: string[] }) =>
      api<Webhook>("/v1/webhooks", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(tenantId) }),
    gcTime: 0, // the response holds the signing secret, shown once
    meta: { successMessage: "Webhook created", silentError: true }, // the sheet shows the error
  });
}

/** Disables a webhook, dropping it from the list at once and restoring it if the call fails. */
export function useDisableWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const listKey = developerKeys.webhooks(tenantId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/webhooks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey, exact: true });
      const previous = qc.getQueryData<{ items: Webhook[] }>(listKey);
      qc.setQueryData<{ items: Webhook[] }>(listKey, (prev) =>
        prev ? { ...prev, items: prev.items.filter((w) => w.id !== id) } : prev,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => qc.setQueryData(listKey, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    meta: { successMessage: "Webhook disabled" },
  });
}

/** Sends a test event to the endpoint already configured. */
export function useTestWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/webhooks/${id}/test`, { method: "POST" }),
    onSettled: (_, __, id) =>
      qc.invalidateQueries({ queryKey: developerKeys.webhook(tenantId, id) }),
    meta: { successMessage: "Test event queued" },
  });
}

/** Re-queues a delivery that was already attempted. */
export function useRetryWebhookDelivery() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, deliveryId }: { webhookId: string; deliveryId: string }) =>
      api<void>(`/v1/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, { method: "POST" }),
    onSettled: (_, __, { webhookId }) =>
      qc.invalidateQueries({ queryKey: developerKeys.webhook(tenantId, webhookId) }),
    meta: { successMessage: "Delivery re-queued" },
  });
}
