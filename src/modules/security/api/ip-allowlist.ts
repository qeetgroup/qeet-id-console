// IP rules are CIDR ranges or bare IPs. Deny wins over allow, and once any allow rule exists an
// address must match one. Rules apply only once the tenant turns enforcement on; then every
// sign-in and session renewal is checked. A change that would refuse the caller's own address is
// refused (risk.rules_lock_out_caller).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

// An action other than these fails the read, rather than show a rule the console can't place.
const ipRule = z.object({
  id: z.string(),
  organization_id: z.string(),
  cidr: z.string(),
  label: z.string(),
  action: z.enum(["allow", "deny"]),
  created_at: z.string(),
});
const ipRules = strictly<Answer<"/v1/organizations/{organizationID}/ip-rules">>()(
  z.object({ enabled: z.boolean(), items: z.array(ipRule), truncated: z.boolean().optional() }),
);
export type IpRule = z.infer<typeof ipRule>;
export type IpAction = IpRule["action"];

export function useIpRules() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.ipRules(organizationId),
    enabled: !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/ip-rules", {
        path: { organizationID: organizationId ?? "" },
        schema: ipRules,
      }),
  });
}

export function useSetIpEnforcement() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.put("/v1/organizations/{organizationID}/ip-rules/config", {
        path: { organizationID: organizationId },
        body: { enabled },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(organizationId) }),
    meta: { successMessage: "security:toast.enforcementUpdated" },
  });
}

export function useAddIpRule() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { cidr: string; label: string; action: IpAction }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/ip-rules", {
        path: { organizationID: organizationId },
        body,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(organizationId) }),
    meta: { successMessage: "security:toast.ruleAdded", silentError: true }, // the form shows it
  });
}

export function useDeleteIpRule() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.delete("/v1/organizations/{organizationID}/ip-rules/{ruleID}", {
        path: { organizationID: organizationId, ruleID: id },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(organizationId) }),
    meta: { successMessage: "security:toast.ruleRemoved" },
  });
}

export function useCheckIp() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (ip: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/ip-rules/check", {
        path: { organizationID: organizationId },
        body: { ip },
      });
    },
    meta: { silent: true },
  });
}

/**
 * A sign-in or renewal the IP rules refused, from its auth.address_refused audit event. `ruleId`
 * and `cidr` name the deny rule; both are null when no allow rule matched or the address was
 * unreadable. `path` names the sign-in; the audit list doesn't return metadata yet, so it is
 * usually "" and `reason` is read from the row: the deny rule is its resource, and an unreadable
 * address is recorded without one (ipallow.refusalEvent).
 */
export interface AddressRefusal {
  id: string;
  at: string;
  address: string;
  path: string;
  reason: RefusalReason | "";
  ruleId: string | null;
  cidr: string | null;
  actorUserId: string | null;
}

export type RefusalReason = "deny_rule" | "not_in_allow_rules" | "address_unknown";
const REASONS: readonly string[] = ["deny_rule", "not_in_allow_rules", "address_unknown"];

interface AuditRow {
  id: string;
  created_at: string;
  ip: string | null;
  actor_user_id?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export function toAddressRefusal(row: AuditRow): AddressRefusal {
  const m = row.metadata ?? {};
  const ruleId = text(m.rule_id) ?? row.resource_id ?? null;
  const said = text(m.reason);
  const reason: AddressRefusal["reason"] =
    said && REASONS.includes(said)
      ? (said as RefusalReason)
      : said
        ? ""
        : ruleId
          ? "deny_rule"
          : row.ip
            ? "not_in_allow_rules"
            : "address_unknown";
  return {
    id: row.id,
    at: row.created_at,
    address: text(m.address) ?? row.ip ?? "",
    path: text(m.path) ?? "",
    reason,
    ruleId,
    cidr: text(m.cidr),
    actorUserId: row.actor_user_id ?? null,
  };
}

/** Fetches the organisation's most recent address-rule refusals, newest first. */
export function useAddressRefusals(limit = 20) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.addressRefusals(organizationId, limit),
    enabled: !!organizationId,
    queryFn: async () => {
      const res = await backend.get("/v1/organizations/{organizationID}/audit", {
        path: { organizationID: organizationId ?? "" },
        query: { action: "auth.address_refused", limit },
      });
      return (res.items ?? []).map(toAddressRefusal);
    },
  });
}

/**
 * The latest change to enforcement: who made it and when (ip_rules.enforcement_changed). Each
 * change is recorded with it, so the latest set today's state.
 */
export function useEnforcementChange() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.enforcementChanges(organizationId),
    enabled: !!organizationId,
    queryFn: async () => {
      const res = await backend.get("/v1/organizations/{organizationID}/audit", {
        path: { organizationID: organizationId ?? "" },
        query: { action: "ip_rules.enforcement_changed", limit: 1 },
      });
      const row = res.items?.[0];
      return row ? { at: row.created_at, actorUserId: row.actor_user_id ?? null } : null;
    },
    meta: { silent: true },
  });
}
