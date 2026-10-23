// IP rules are CIDR ranges or bare IPs. Deny wins over allow, and once any allow rule exists an
// address must match one. Rules apply only once the tenant turns enforcement on, so adding them
// can't lock it out by accident.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

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
    queryKey: ["ip-rules", tenantId],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Enforcement updated" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Rule added" },
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Rule removed" },
  });
}

export function useCheckIp() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (ip: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{ enabled: boolean; allowed: boolean; reason: string }>(
        `/v1/tenants/${tenantId}/ip-rules/check`,
        { method: "POST", body: { ip } },
      );
    },
    meta: { silent: true },
  });
}

/**
 * A sign-in or renewal the IP rules refused, from its auth.address_refused audit event. `ruleId`
 * and `cidr` name the deny rule; both are null when no allow rule matched or the address was
 * unreadable.
 */
export interface AddressRefusal {
  id: string;
  at: string;
  address: string;
  path: string;
  reason: string;
  ruleId: string | null;
  cidr: string | null;
}

interface AuditRow {
  id: string;
  created_at: string;
  ip: string | null;
  metadata?: Record<string, unknown> | null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export function toAddressRefusal(row: AuditRow): AddressRefusal {
  const m = row.metadata ?? {};
  return {
    id: row.id,
    at: row.created_at,
    address: text(m.address) ?? row.ip ?? "",
    path: text(m.path) ?? "",
    reason: text(m.reason) ?? "",
    ruleId: text(m.rule_id),
    cidr: text(m.cidr),
  };
}

/** Fetches the organisation's most recent address-rule refusals, newest first. */
export function useAddressRefusals(limit = 20) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["ip-rules", "refusals", tenantId, limit],
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await api<{ items: AuditRow[] }>(`/v1/tenants/${tenantId}/audit`, {
        query: { action: "auth.address_refused", limit },
      });
      return (res.items ?? []).map(toAddressRefusal);
    },
  });
}
