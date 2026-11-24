// A connection's actions from the Connections list, apart from the directory's reads (directory.ts,
// which the shell carries through the Dashboard): only the Connections page loads these. They move
// here with the SCIM and LDAP pages, whose own copies (authentication/api/ldap.ts, scim.ts) go
// then; the server asks the person to confirm it's them for each but the test.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import { useOrganizationId } from "@/platform/auth/session";
import { directoryKeys } from "./keys";

function useConnectionMutation<T>(run: (organizationId: string | null, id: string) => Promise<T>) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => run(organizationId, id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
  });
}

/** Tries the LDAP connection: binds as its service account. The server records the result. */
export function useTestLdapConnection() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/ldap/{id}/test", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
    meta: { silentError: true }, // the page says how the test went
  });
}

/** Turns an LDAP connection on (people can sign in with it) or off. */
export function useSetLdapStatus() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      backend.patch("/v1/organizations/{organizationID}/ldap/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body: { status: on ? "active" : "disabled" },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
  });
}

/** Deletes an LDAP connection; the people who signed in with it keep their accounts. */
export function useDeleteLdapConnection() {
  return useConnectionMutation((organizationId, id) =>
    backend.delete("/v1/organizations/{organizationID}/ldap/{id}", {
      path: { organizationID: organizationId ?? "", id },
    }),
  );
}

/** Revokes the SCIM token: the identity provider can no longer send changes. */
export function useRevokeScimToken() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      backend.delete("/v1/organizations/{organizationID}/scim/token", {
        path: { organizationID: organizationId ?? "" },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
    meta: { successMessage: "directory:toast.scimTokenRevoked" },
  });
}
