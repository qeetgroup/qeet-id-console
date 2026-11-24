// A connection's mappings, for the Mappings page only: apart from the reads the shell carries
// through the Dashboard (directory.ts), so their schemas load with this page.
//
// Server facts (internal/federation/directory/mapping*.go): saving or deleting a mapping needs
// connection.write and asks the person to confirm it's them; a change sends the version it read and
// a stale one is refused (409), as is a second mapping turned on for one field. The preview only
// computes the profile the saved mappings make from an entry; it needs connection.read.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { directoryKeys } from "./keys";

const MAPPINGS = "/v1/organizations/{organizationID}/directory/connections/{connectionID}/mappings";
const MAPPING = `${MAPPINGS}/{mappingID}` as const;

/** The profile fields a mapping can fill. */
export const TARGET_FIELDS = [
  "email",
  "display_name",
  "first_name",
  "last_name",
  "department",
  "title",
  "manager_id",
  "groups",
] as const;

const mappingShape = z.object({
  id: z.string(),
  source_attribute: z.string(),
  target_field: z.enum(TARGET_FIELDS),
  value_type: z.enum(["string", "array"]),
  transform: z.enum(["none", "trim", "lowercase", "uppercase", "extract"]),
  pattern: z.string(),
  enabled: z.boolean(),
  required: z.boolean(),
  version: z.number().int(),
});
const mappingsSchema = strictly<Answer<typeof MAPPINGS>>()(
  z.object({
    items: z.array(mappingShape),
    targets: z.record(z.string(), z.enum(["string", "array"])),
  }),
);
export const mappingSchema = strictly<Answer<typeof MAPPING, "put">>()(mappingShape);
const createdMapping = strictly<Answer<typeof MAPPINGS, "post">>()(mappingShape);
const previewShape = z.object({
  profile: z.record(z.string(), z.unknown()),
  values: z.record(z.string(), z.unknown()),
  // Each issue's `message` is backend text, so the schema drops it; the code carries the meaning.
  issues: z.array(z.object({ mapping_id: z.string(), field: z.string(), code: z.string() })),
  valid: z.boolean(),
});
export const mappingPreviewSchema =
  strictly<Answer<`${typeof MAPPINGS}/preview`, "post">>()(previewShape);
export type DirectoryMapping = z.infer<typeof mappingShape>;
export type DirectoryMappings = z.output<typeof mappingsSchema>;
export type MappingPreview = z.infer<typeof previewShape>;
export type MappingInput = Omit<DirectoryMapping, "id" | "version"> & {
  id?: string;
  version?: number;
};

const at = (organizationId: string | null, connectionId: string) => ({
  organizationID: organizationId ?? "",
  connectionID: connectionId,
});

export function useDirectoryMappings(connectionId: string) {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.mappings(organizationId, connectionId),
    queryFn: () =>
      backend.get(MAPPINGS, { path: at(organizationId, connectionId), schema: mappingsSchema }),
    enabled: !!organizationId && !!connectionId && access.can("connection.read"),
  });
}

export function useSaveDirectoryMapping(connectionId: string) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping: MappingInput) => {
      const { id, ...body } = mapping;
      const path = at(organizationId, connectionId);
      return id
        ? backend.put(MAPPING, { path: { ...path, mappingID: id }, body, schema: mappingSchema })
        : backend.post(MAPPINGS, { path, body, schema: createdMapping });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: directoryKeys.mappings(organizationId, connectionId),
      }),
    meta: { successMessage: "directory:toast.mappingSaved", silentError: true }, // the form shows it
  });
}

export function useDeleteDirectoryMapping(connectionId: string) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete(MAPPING, { path: { ...at(organizationId, connectionId), mappingID: id } }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: directoryKeys.mappings(organizationId, connectionId),
      }),
    meta: { successMessage: "directory:toast.mappingRemoved" },
  });
}

export function usePreviewDirectoryMappings(connectionId: string) {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (source: Record<string, unknown>) =>
      backend.post(`${MAPPINGS}/preview`, {
        path: at(organizationId, connectionId),
        body: { source },
        schema: mappingPreviewSchema,
      }),
    meta: { silent: true }, // the page shows the result and any error
  });
}
