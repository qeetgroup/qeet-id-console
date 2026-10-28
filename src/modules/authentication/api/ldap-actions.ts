// An LDAP connection's changes, apart from its reads (ldap.ts, which the Dashboard carries): only
// the LDAP pages load these. Each refreshes the connection and the Directories list (its health
// and events). The server asks the person to confirm it's them for each but the test
// (internal/bootstrap/stepup.go).
//
// Directories › Connections has its own copies of test, turn on or off and delete
// (directory/api/connection-actions.ts): one set should stay once these pages move into the
// directory module (see console-redesign-mockups/auth-connections/MIGRATION-NOTES.md).

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { directoryKeys } from "@/modules/directory";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import type { CreateLdapInput, LdapConnection } from "./ldap";

function useRefresh() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return {
    tenantId,
    refresh: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: authKeys.ldap(tenantId) }),
        qc.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
      ]),
  };
}

export function useCreateLdapConnection() {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (body: CreateLdapInput) =>
      api<LdapConnection>(`/v1/tenants/${tenantId}/ldap`, { method: "POST", body }),
    onSuccess: () => refresh(),
    meta: { successMessage: "connections:toast.ldapCreated", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateLdapConnection({ inline = false }: { inline?: boolean } = {}) {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateLdapInput> & { id: string }) =>
      api<LdapConnection>(`/v1/tenants/${tenantId}/ldap/${id}`, { method: "PATCH", body }),
    onSuccess: () => refresh(),
    meta: { silentError: inline },
  });
}

export function useDeleteLdapConnection() {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/ldap/${id}`, { method: "DELETE" }),
    onSuccess: () => refresh(),
  });
}

/**
 * Tries the connection: Qeet ID dials the server and binds as the service account, nothing more
 * (no person is looked up). The server records the result as the connection's latest test.
 */
export function useTestLdapConnection() {
  const { tenantId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/v1/tenants/${tenantId}/ldap/${id}/test`, { method: "POST" }),
    onSettled: () => refresh(),
    meta: { silentError: true }, // the page shows the result
  });
}
