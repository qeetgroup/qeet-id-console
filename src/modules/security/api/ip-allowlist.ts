// IP rules are CIDR ranges or bare IPs. Deny wins over allow, and once any allow rule exists an
// address must match one. Rules apply only once the tenant turns enforcement on; then every
// sign-in and session renewal is checked. A change that would refuse the caller's own address is
// refused (risk.rules_lock_out_caller).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export type IpAction = "allow" | "deny";

export interface IpRule {
  id: string;
  tenant_id: string;
  cidr: string;
  label: string;
  action: IpAction;
  created_at: string;
}

export function useIpRules() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.ipRules(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<{ enabled: boolean; items: IpRule[] }>(`/v1/tenants/${tenantId}/ip-rules`),
  });
}

export function useSetIpEnforcement() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{ enabled: boolean }>(`/v1/tenants/${tenantId}/ip-rules/config`, {
        method: "PUT",
        body: { enabled },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(tenantId) }),
    meta: { successMessage: "security:toast.enforcementUpdated" },
  });
}

export function useAddIpRule() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { cidr: string; label: string; action: IpAction }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<IpRule>(`/v1/tenants/${tenantId}/ip-rules`, { method: "POST", body });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(tenantId) }),
    meta: { successMessage: "security:toast.ruleAdded", silentError: true }, // the form shows it
  });
}

export function useDeleteIpRule() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/ip-rules/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.ipRules(tenantId) }),
    meta: { successMessage: "security:toast.ruleRemoved" },
  });
}

export function useCheckIp() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (ip: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{
        enabled: boolean;
        allowed: boolean;
        reason: string; // English, or a bare code from a server without reason_code; never shown
        reason_code?: string; // ip.allowed, ip.deny_rule, ip.not_in_allow_rules, ...
        reason_params?: { cidr?: string }; // the deny rule that refused it
      }>(`/v1/tenants/${tenantId}/ip-rules/check`, { method: "POST", body: { ip } });
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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.addressRefusals(tenantId, limit),
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await api<{ items: AuditRow[] }>(`/v1/tenants/${tenantId}/audit`, {
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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.enforcementChanges(tenantId),
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await api<{ items: AuditRow[] }>(`/v1/tenants/${tenantId}/audit`, {
        query: { action: "ip_rules.enforcement_changed", limit: 1 },
      });
      const row = res.items?.[0];
      return row ? { at: row.created_at, actorUserId: row.actor_user_id ?? null } : null;
    },
    meta: { silent: true },
  });
}
