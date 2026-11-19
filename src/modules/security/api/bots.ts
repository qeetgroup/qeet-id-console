// Bot verdicts the server's user-agent scorer records, detect-only, on sign-in and session
// attempts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

type BotPage = Answer<"/v1/organizations/{organizationID}/security/bots">;
export type BotEvent = BotPage["items"][number];
export type BotStats = BotPage["stats"];

// The pages show the newest verdicts: one page, the most the server sends at once.
const RECENT = 200;

export interface BotSettings {
  ua_check: boolean;
  honeypot: boolean;
  captcha: boolean;
  signature: boolean;
  score_threshold: number;
}

export function useBotOverview() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.botOverview(organizationId),
    queryFn: async (): Promise<{ recent: BotEvent[]; stats: BotStats }> => {
      try {
        const page = await backend.get("/v1/organizations/{organizationID}/security/bots", {
          path: { organizationID: organizationId ?? "" },
          query: { limit: RECENT },
        });
        return { recent: page.items, stats: page.stats };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return {
            recent: [],
            stats: { blocked_24h: 0, challenged_24h: 0, threshold: 0.7 },
          };
        }
        throw err;
      }
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useBotSettings() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.botSettings(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/security/bots/settings", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}

export function useUpdateBotSettings() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: BotSettings) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.put("/v1/organizations/{organizationID}/security/bots/settings", {
        path: { organizationID: organizationId },
        body: settings,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.bots(organizationId) }),
    meta: { successMessage: "security:toast.botProtectionSettingsSaved" },
  });
}
