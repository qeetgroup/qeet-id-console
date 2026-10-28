// Outbound webhooks: the tenant's endpoints, the events they can subscribe to, their delivery log,
// and test or retried deliveries. The server disables an endpoint that keeps failing.

import { queryOptions, useQuery } from "@tanstack/react-query";

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
