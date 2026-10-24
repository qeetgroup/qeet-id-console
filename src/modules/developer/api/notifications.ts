import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { developerKeys } from "./keys";

export type NotificationKind = "info" | "warning" | "alert" | "success";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  description?: string;
  created_at: string;
  read_at?: string | null; // set once the user has read it
  href?: string | null; // in-app link the notification opens
}

interface NotificationsResponse {
  items: Notification[];
  unread_count: number;
}

const EMPTY: NotificationsResponse = { items: [], unread_count: 0 };

/**
 * Fetches the current user's notification inbox, polling every minute while the tab is visible.
 * A backend without the endpoint (404) yields an empty inbox.
 */
export function useNotifications() {
  return useQuery({
    queryKey: developerKeys.notifications(useTenantId()),
    queryFn: async (): Promise<NotificationsResponse> => {
      try {
        return await api<NotificationsResponse>("/v1/notifications");
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
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>("/v1/notifications/mark-all-read", { method: "POST" }).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return;
        throw err;
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.notifications(tenantId) }),
    meta: { silent: true },
  });
}
