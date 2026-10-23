// Bot verdicts the server's user-agent scorer records, detect-only, on sign-in and session
// attempts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface BotEvent {
  id: string;
  ip?: string | null;
  user_agent: string;
  score: number;
  verdict: string;
  created_at: string;
}

export interface BotStats {
  blocked_24h: number;
  challenged_24h: number;
  threshold: number;
}

export interface BotSettings {
  ua_check: boolean;
  honeypot: boolean;
  captcha: boolean;
  signature: boolean;
  score_threshold: number;
}

export function useBotOverview() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.botOverview(tenantId),
    queryFn: async (): Promise<{ recent: BotEvent[]; stats: BotStats }> => {
      try {
        return await api<{ recent: BotEvent[]; stats: BotStats }>(
          `/v1/tenants/${tenantId}/security/bots`,
        );
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
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useBotSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.botSettings(tenantId),
    queryFn: () => api<BotSettings>(`/v1/tenants/${tenantId}/security/bots/settings`),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

export function useUpdateBotSettings() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: BotSettings) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<BotSettings>(`/v1/tenants/${tenantId}/security/bots/settings`, {
        method: "PUT",
        body: settings,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.bots(tenantId) }),
    meta: { successMessage: "security:toast.botProtectionSettingsSaved" },
  });
}
