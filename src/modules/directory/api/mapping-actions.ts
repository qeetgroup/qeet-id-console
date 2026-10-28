// What Mappings changes, apart from the directory's reads (directory.ts, which the shell carries
// through the Dashboard): only the Mappings page loads these.
//
// Server facts (internal/federation/directory/mapping*.go): saving or deleting a mapping needs
// connection.write and asks the person to confirm it's them; a change sends the version it read and
// a stale one is refused (409), as is a second mapping turned on for one field. The preview only
// computes the profile the saved mappings make from an entry; it needs connection.read.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { type MappingInput, mappingPath, mappingPreviewSchema, mappingSchema } from "./directory";
import { directoryKeys } from "./keys";

export function useSaveDirectoryMapping(connectionId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping: MappingInput) => {
      const { id, ...body } = mapping;
      return api(
        `${mappingPath(tenantId, connectionId)}${id ? `/${encodeURIComponent(id)}` : ""}`,
        {
          method: id ? "PUT" : "POST",
          body,
          schema: mappingSchema,
        },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.mappings(tenantId, connectionId) }),
    meta: { successMessage: "directory:toast.mappingSaved", silentError: true }, // the form shows it
  });
}

export function useDeleteDirectoryMapping(connectionId: string) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`${mappingPath(tenantId, connectionId)}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: directoryKeys.mappings(tenantId, connectionId) }),
    meta: { successMessage: "directory:toast.mappingRemoved" },
  });
}

export function usePreviewDirectoryMappings(connectionId: string) {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (source: Record<string, unknown>) =>
      api(`${mappingPath(tenantId, connectionId)}/preview`, {
        method: "POST",
        body: { source },
        schema: mappingPreviewSchema,
      }),
    meta: { silent: true }, // the page shows the result and any error
  });
}
