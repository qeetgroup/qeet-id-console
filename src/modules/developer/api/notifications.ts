import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { isOneOf } from "@/shared/utils/one-of";
import { developerKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

const KINDS = ["info", "warning", "alert", "success"] as const;
export type NotificationKind = (typeof KINDS)[number];

/** A notification's kind as the console knows it, else plain information. */
export const notificationKind = (kind: string): NotificationKind =>
  isOneOf(KINDS, kind) ? kind : "info";

// A notification's `href` is the in-app link it opens; `read_at` is set once the person has read it.
type NotificationsResponse = Answer<"/v1/notifications">;
export type Notification = NotificationsResponse["items"][number];

const EMPTY: NotificationsResponse = { items: [], unread_count: 0 };

/**
 * Fetches the current user's notification inbox, polling every minute while the tab is visible.
 * A backend without the endpoint (404) yields an empty inbox.
 */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: developerKeys.notifications(useOrganizationId()),
    enabled,
    queryFn: async (): Promise<NotificationsResponse> => {
      try {
        return await backend.get("/v1/notifications");
      } catch (err) {
        // Only a missing endpoint reads as empty; auth and server errors still surface.
        if (err instanceof ApiError && err.status === 404) return EMPTY;
        throw err;
      }
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    meta: { silent: true }, // a failing poll would otherwise toast every minute
  });
}

/** Marks all in-app notifications read; a backend without the endpoint (404) is a no-op. */
export function useMarkAllRead() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      backend.post("/v1/notifications/mark-all-read").catch((err) => {
        if (err instanceof ApiError && err.status === 404) return;
        throw err;
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: developerKeys.notifications(organizationId) }),
    meta: { silent: true },
  });
}
