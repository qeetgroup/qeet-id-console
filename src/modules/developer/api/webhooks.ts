// Outbound webhooks: the tenant's endpoints, the events they can subscribe to, their delivery log,
// and test or retried deliveries. The server disables an endpoint that keeps failing.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";

import { developerKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

/**
 * An endpoint: the signing secret only in the create answer; whether an administrator disabled it
 * or its failures did, when deliveries started failing, and until when the previous secret signs
 * too after a rotation.
 */
export type Webhook = Answer<"/v1/webhooks/{id}">;

/** An event a webhook can subscribe to, from the server's catalogue. */
export interface WebhookEventType {
  name: string; // also its version: an incompatible payload gets a new name
  description: string; // English, never shown: the console words each event itself
}

/** One attempt to deliver an event; `error` and `response_body` come from the receiving endpoint. */
export type WebhookDelivery = NonNullable<Answer<"/v1/webhooks/{id}/deliveries">["items"]>[number];

// The page works out its rates from the recent deliveries: one page, the most the server sends.
const RECENT_DELIVERIES = 200;

export const webhookQueries = {
  events: (organizationId: string | null) =>
    queryOptions({
      queryKey: developerKeys.webhookEvents(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/webhooks/events", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
      staleTime: 60 * 60_000, // the catalogue changes only with a server release
    }),
  list: (organizationId: string | null) =>
    queryOptions({
      queryKey: developerKeys.webhooks(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/webhooks", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
  detail: (organizationId: string | null, id: string) =>
    queryOptions({
      queryKey: [...developerKeys.webhook(organizationId, id), "detail"],
      queryFn: () => backend.get("/v1/webhooks/{id}", { path: { id } }),
      enabled: !!organizationId && !!id,
    }),
  deliveries: (organizationId: string | null, id: string) =>
    queryOptions({
      queryKey: [...developerKeys.webhook(organizationId, id), "deliveries"],
      queryFn: () =>
        backend.get("/v1/webhooks/{id}/deliveries", {
          path: { id },
          query: { limit: RECENT_DELIVERIES },
        }),
      enabled: !!organizationId && !!id,
      retry: false,
      meta: { silent: true }, // the page shows the log's own empty and error states
    }),
};

export function useWebhookEvents() {
  return useQuery(webhookQueries.events(useOrganizationId()));
}

export function useWebhooks() {
  return useQuery(webhookQueries.list(useOrganizationId()));
}

export function useWebhook(id: string) {
  return useQuery(webhookQueries.detail(useOrganizationId(), id));
}

export function useWebhookDeliveries(id: string) {
  return useQuery(webhookQueries.deliveries(useOrganizationId(), id));
}
