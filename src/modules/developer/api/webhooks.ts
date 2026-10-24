// Outbound webhooks: the tenant's endpoints, the events they can subscribe to, their delivery log,
// and test or retried deliveries. The server disables an endpoint that keeps failing.

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
  disabled_reason?: "disabled" | "failing" | null; // by an administrator, or by its failures
  failing_since?: string | null; // when deliveries started failing
  previous_secret_expires_at?: string | null; // the old secret signs too until then
  created_at: string;
}

/** An event a webhook can subscribe to, from the server's catalogue. */
export interface WebhookEventType {
  name: string; // also its version: an incompatible payload gets a new name
  description: string; // English, never shown: the console words each event itself
}

/** A rotated signing secret, shown once; the previous one keeps signing until the expiry. */
export interface RotatedWebhookSecret {
  secret: string;
  previous_secret_expires_at: string;
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
  events: (tenantId: string | null) =>
    queryOptions({
      queryKey: developerKeys.webhookEvents(tenantId),
      queryFn: () => api<{ items: WebhookEventType[] }>(`/v1/tenants/${tenantId}/webhooks/events`),
      enabled: !!tenantId,
      staleTime: 60 * 60_000, // the catalogue changes only with a server release
    }),
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

export function useWebhookEvents() {
  return useQuery(webhookQueries.events(useTenantId()));
}

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
    meta: { successMessage: "developer:toast.webhookCreated", silentError: true }, // the sheet shows the error
  });
}

/**
 * Disables a webhook. It stays listed, so it can be enabled again; the list marks it disabled at
 * once and restores it if the call fails.
 */
export function useDisableWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const listKey = developerKeys.webhooks(tenantId);
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/webhooks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: listKey, exact: true });
      const previous = qc.getQueryData<{ items: Webhook[] }>(listKey);
      const disabledAt = new Date().toISOString();
      qc.setQueryData<{ items: Webhook[] }>(listKey, (prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((w) =>
                w.id === id ? { ...w, disabled_at: disabledAt, disabled_reason: "disabled" } : w,
              ),
            }
          : prev,
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => qc.setQueryData(listKey, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: listKey }),
    meta: { successMessage: "developer:toast.webhookDisabled" },
  });
}

/** Turns a disabled webhook back on, forgetting its failures. */
export function useEnableWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Webhook>(`/v1/tenants/${tenantId}/webhooks/${id}/enable`, { method: "POST" }),
    onSettled: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(tenantId) }),
    meta: { successMessage: "developer:toast.webhookEnabled" },
  });
}

/** Issues a new signing secret; the response holds it, shown once. */
export function useRotateWebhookSecret() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<RotatedWebhookSecret>(`/v1/tenants/${tenantId}/webhooks/${id}/rotate-secret`, {
        method: "POST",
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(tenantId) }),
    gcTime: 0, // the response holds the new secret
    meta: { successMessage: "developer:toast.webhookSecretRotated" },
  });
}

/** Queues a test event to the endpoint (the server answers 202 once it's queued). */
export function useTestWebhook() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ queued: boolean }>(`/v1/webhooks/${id}/test`, { method: "POST" }),
    onSettled: (_, __, id) =>
      qc.invalidateQueries({ queryKey: developerKeys.webhook(tenantId, id) }),
    meta: { successMessage: "developer:toast.testEventQueued" },
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
    meta: { successMessage: "developer:toast.deliveryReQueued" },
  });
}
