// What the webhook pages change: create, disable, enable, rotate the secret, test, retry a
// delivery. Only those pages use them, so the shell (which carries the barrel) doesn't.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import type { RotatedWebhookSecret, Webhook } from "./webhooks";

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
