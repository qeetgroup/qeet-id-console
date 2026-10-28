// A connection's actions from the Connections list, apart from the directory's reads (directory.ts,
// which the shell carries through the Dashboard): only the Connections page loads these. They move
// here with the SCIM and LDAP pages, whose own copies (authentication/api/ldap.ts, scim.ts) go
// then; the server asks the person to confirm it's them for each but the test.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { directoryKeys } from "./keys";

function useConnectionMutation<T>(run: (tenantId: string | null, id: string) => Promise<T>) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => run(tenantId, id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
  });
}

/** Tries the LDAP connection: binds as its service account. The server records the result. */
export function useTestLdapConnection() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/v1/tenants/${tenantId}/ldap/${id}/test`, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
    meta: { silentError: true }, // the page says how the test went
  });
}

/** Turns an LDAP connection on (people can sign in with it) or off. */
export function useSetLdapStatus() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      api(`/v1/tenants/${tenantId}/ldap/${id}`, {
        method: "PATCH",
        body: { status: on ? "active" : "disabled" },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
  });
}

/** Deletes an LDAP connection; the people who signed in with it keep their accounts. */
export function useDeleteLdapConnection() {
  return useConnectionMutation((tenantId, id) =>
    api<void>(`/v1/tenants/${tenantId}/ldap/${id}`, { method: "DELETE" }),
  );
}

/** Revokes the SCIM token: the identity provider can no longer send changes. */
export function useRevokeScimToken() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/scim/token`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
    meta: { successMessage: "directory:toast.scimTokenRevoked" },
  });
}
