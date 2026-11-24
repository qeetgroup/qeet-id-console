// An auth hook is a synchronous policy gate after the credential check: Qeet POSTs a signed event
// to the hook URL and honours its allow or deny. The secret is write-only.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import { developerKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export interface AuthHook {
  id: string;
  trigger: string;
  url: string;
  enabled: boolean;
  fail_open: boolean;
  created_at: string;
}

export function useAuthHooks() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: developerKeys.authHooks(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/auth-hooks", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
  });
}

export function useCreateAuthHook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; secret: string; fail_open: boolean }) =>
      backend.post("/v1/organizations/{organizationID}/auth-hooks", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.authHooks(organizationId) }),
    meta: { successMessage: "developer:toast.hookAdded", silentError: true },
  });
}

export function useUpdateAuthHook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      enabled,
      fail_open,
    }: {
      id: string;
      enabled: boolean;
      fail_open: boolean;
    }) =>
      backend.patch("/v1/organizations/{organizationID}/auth-hooks/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body: { enabled, fail_open },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.authHooks(organizationId) }),
    meta: { successMessage: "developer:toast.authHookUpdated" },
  });
}

export function useDeleteAuthHook() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/auth-hooks/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.authHooks(organizationId) }),
    meta: { successMessage: "developer:toast.authHookDeleted" },
  });
}
