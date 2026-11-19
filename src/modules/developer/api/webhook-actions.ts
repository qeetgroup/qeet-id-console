// What the webhook pages change: create, disable, enable, rotate the secret, test, retry a
// delivery. Only those pages use them, so the shell (which carries the barrel) doesn't.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import type { Webhook } from "./webhooks";
import { backend } from "@/platform/api/backend";

export function useCreateWebhook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    // The organization is the caller's.
    mutationFn: (body: { url: string; events: string[] }) => backend.post("/v1/webhooks", { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(organizationId) }),
    gcTime: 0, // the response holds the signing secret, shown once
    meta: { successMessage: "developer:toast.webhookCreated", silentError: true }, // the sheet shows the error
  });
}

/**
 * Disables a webhook. It stays listed, so it can be enabled again; the list marks it disabled at
 * once and restores it if the call fails.
 */
export function useDisableWebhook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  const listKey = developerKeys.webhooks(organizationId);
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/webhooks/{id}", { path: { id } }),
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
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/webhooks/{id}/enable", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(organizationId) }),
    meta: { successMessage: "developer:toast.webhookEnabled" },
  });
}

/** Issues a new signing secret; the response holds it, shown once. */
export function useRotateWebhookSecret() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/webhooks/{id}/rotate-secret", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: developerKeys.webhooks(organizationId) }),
    gcTime: 0, // the response holds the new secret
    meta: { successMessage: "developer:toast.webhookSecretRotated" },
  });
}

/** Queues a test event to the endpoint (the server answers 202 once it's queued). */
export function useTestWebhook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.post("/v1/webhooks/{id}/test", { path: { id } }),
    onSettled: (_, __, id) =>
      qc.invalidateQueries({ queryKey: developerKeys.webhook(organizationId, id) }),
    meta: { successMessage: "developer:toast.testEventQueued" },
  });
}

/** Re-queues a delivery that was already attempted. */
export function useRetryWebhookDelivery() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, deliveryId }: { webhookId: string; deliveryId: string }) =>
      backend.post("/v1/webhooks/{id}/deliveries/{deliveryID}/retry", {
        path: { id: webhookId, deliveryID: deliveryId },
      }),
    onSettled: (_, __, { webhookId }) =>
      qc.invalidateQueries({ queryKey: developerKeys.webhook(organizationId, webhookId) }),
    meta: { successMessage: "developer:toast.deliveryReQueued" },
  });
}
