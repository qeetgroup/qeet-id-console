// A connection's mappings, for the Mappings page only: apart from the reads the shell carries
// through the Dashboard (directory.ts), so their schemas load with this page.
//
// Server facts (internal/federation/directory/mapping*.go): saving or deleting a mapping needs
// connection.write and asks the person to confirm it's them; a change sends the version it read and
// a stale one is refused (409), as is a second mapping turned on for one field. The preview only
// computes the profile the saved mappings make from an entry; it needs connection.read.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { directoryKeys } from "./keys";

export const mappingSchema = z.object({
  id: z.string(),
  source_attribute: z.string(),
  target_field: z.string(),
  value_type: z.enum(["string", "array"]),
  transform: z.enum(["none", "trim", "lowercase", "uppercase", "extract"]),
  pattern: z.string(),
  enabled: z.boolean(),
  required: z.boolean(),
  version: z.number().int(),
});
const mappingsSchema = z.object({
  items: z.array(mappingSchema),
  targets: z.record(z.string(), z.enum(["string", "array"])),
});
export const mappingPreviewSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
  values: z.record(z.string(), z.unknown()),
  // Each issue's `message` is backend text, so the schema drops it; the code carries the meaning.
  issues: z.array(z.object({ mapping_id: z.string(), field: z.string(), code: z.string() })),
  valid: z.boolean(),
});
export type DirectoryMapping = z.infer<typeof mappingSchema>;
export type DirectoryMappings = z.infer<typeof mappingsSchema>;
export type MappingPreview = z.infer<typeof mappingPreviewSchema>;
export type MappingInput = Omit<DirectoryMapping, "id" | "version"> & {
  id?: string;
  version?: number;
};

export function mappingPath(tenantId: string | null, connectionId: string) {
  return `/v1/tenants/${tenantId}/directory/connections/${encodeURIComponent(connectionId)}/mappings`;
}

export function useDirectoryMappings(connectionId: string) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.mappings(tenantId, connectionId),
    queryFn: () => api(mappingPath(tenantId, connectionId), { schema: mappingsSchema }),
    enabled: !!tenantId && !!connectionId && access.can("connection.read"),
  });
}

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
