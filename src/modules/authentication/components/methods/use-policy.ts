import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useAnalyticsOverview } from "@/modules/dashboard";
import { orgKeys } from "@/modules/organizations";
import { type AuthPolicy, useUpdateAuthPolicy } from "@/modules/authentication/api/auth-policy";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  type SensitiveActionOptions,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** The part of the policy one change sets. */
export type PolicyChange = Partial<Omit<AuthPolicy, "lockout_limits">>;

/**
 * Saves one change to the auth policy behind a step-up (and a confirm, when given). PUT replaces
 * the whole object, so the change is merged into the policy the page loaded; it resolves with the
 * saved policy, and rejects as the shared runner does (a cancelled step-up or confirm included).
 */
export function useSavePolicy(policy: AuthPolicy) {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const update = useUpdateAuthPolicy();
  return {
    pending: update.isPending,
    error: update.error,
    reset: update.reset,
    run: (change: PolicyChange, confirm?: SensitiveActionOptions<AuthPolicy>["confirm"]) =>
      runSensitive({
        confirm,
        actionLabel: t("methods.savePolicy"),
        run: () => update.mutateAsync({ ...policy, ...change }),
      }),
  };
}

/** The first-factor methods; at least one of them has to stay on. */
const FIRST_FACTORS = ["password_enabled", "passkey_enabled", "magic_link_enabled"] as const;

/** Whether `key` is the only first-factor method on, so it can't be turned off. */
export function isLastMethod(policy: AuthPolicy, key: (typeof FIRST_FACTORS)[number]): boolean {
  return policy[key] && FIRST_FACTORS.every((other) => other === key || !policy[other]);
}

/** Each sign-in method's share of the last 30 days' sign-ins, in whole percent. */
export type SignInMix = Partial<Record<string, number>>;

/**
 * The share of sign-ins each method had in the last 30 days (the analytics overview's mix, from
 * the audit log's successful sign-ins). Undefined without access to analytics or until it loads,
 * so a page leaves the sentence out rather than say 0%.
 */
export function useSignInMix(): SignInMix | undefined {
  const can = useCapabilities().can("analytics.read");
  const overview = useAnalyticsOverview(can).data;
  if (!can || !overview || overview.login_methods_mix.length === 0) return undefined;
  return Object.fromEntries(
    overview.login_methods_mix.map((slice) => [slice.method, Math.round(slice.value)]),
  );
}

/**
 * Whether two-step verification is required (Settings › Security's rule, `mfa_enforcement`). Read
 * under the Organisations module's key, so both pages share one copy; until that module offers
 * its query, this reads the same endpoint.
 */
export function useTwoStepRule(enabled: boolean) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: orgKeys.securityPolicy(tenantId),
    queryFn: () => api<{ mfa_enforcement: string }>(`/v1/tenants/${tenantId}/policy`),
    enabled: enabled && !!tenantId,
    select: (policy) => policy.mfa_enforcement,
  });
}
