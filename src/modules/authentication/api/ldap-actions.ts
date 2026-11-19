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
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import type { CreateLdapInput } from "./ldap";
import { backend } from "@/platform/api/backend";

function useRefresh() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return {
    organizationId,
    refresh: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: authKeys.ldap(organizationId) }),
        qc.invalidateQueries({ queryKey: directoryKeys.organization(organizationId) }),
      ]),
  };
}

export function useCreateLdapConnection() {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (body: CreateLdapInput) =>
      backend.post("/v1/organizations/{organizationID}/ldap", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => refresh(),
    meta: { successMessage: "connections:toast.ldapCreated", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateLdapConnection({ inline = false }: { inline?: boolean } = {}) {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateLdapInput> & { id: string }) =>
      backend.patch("/v1/organizations/{organizationID}/ldap/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body,
      }),
    onSuccess: () => refresh(),
    meta: { silentError: inline },
  });
}

export function useDeleteLdapConnection() {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/ldap/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => refresh(),
  });
}

/**
 * Tries the connection: Qeet ID dials the server and binds as the service account, nothing more
 * (no person is looked up). The server records the result as the connection's latest test.
 */
export function useTestLdapConnection() {
  const { organizationId, refresh } = useRefresh();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/ldap/{id}/test", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSettled: () => refresh(),
    meta: { silentError: true }, // the page shows the result
  });
}
