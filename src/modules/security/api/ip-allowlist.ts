// IP allow/deny rule data layer. Rules are CIDR ranges (or bare IPs); deny wins
// over allow, and if any allow rule exists an address must match one. A
// per-tenant enable flag gates enforcement so a tenant can't lock itself out by
// accident.

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
    mutationFn: (enabled: boolean) =>
      api<{ enabled: boolean }>(`/v1/tenants/${tenantId}/ip-rules/config`, {
        method: "PUT",
        body: { enabled },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Enforcement updated" },
  });
}

export function useAddIpRule() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { cidr: string; label: string; action: IpAction }) =>
      api<IpRule>(`/v1/tenants/${tenantId}/ip-rules`, { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Rule added" },
  });
}

export function useDeleteIpRule() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/ip-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ip-rules"] }),
    meta: { successMessage: "Rule removed" },
  });
}

export function useCheckIp() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (ip: string) =>
      api<{ enabled: boolean; allowed: boolean; reason: string }>(
        `/v1/tenants/${tenantId}/ip-rules/check`,
        { method: "POST", body: { ip } },
      ),
    meta: { silent: true },
  });
}

// A sign-in or renewal the rules refused, as the audit log records it
// (auth.address_refused). rule_id and cidr are the deny rule responsible; an
// address outside every allow rule, or one that couldn't be read, has none.
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

/** The organisation's most recent address-rule refusals, newest first. */
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
