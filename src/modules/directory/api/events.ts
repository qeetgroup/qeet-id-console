// The directory's events, for Sync activity and the Connections band: apart from the reads the
// shell carries through the Dashboard (directory.ts), so their schemas load with those pages only.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type EventFilters, eventSchema } from "./directory";
import { directoryKeys } from "./keys";

export const eventPageSchema = z.object({
  items: z.array(eventSchema),
  total: z.number().nonnegative(),
  limit: z.number(),
  offset: z.number(),
  summary: z.object({
    total: z.number(),
    successful: z.number(),
    warnings: z.number(),
    failed: z.number(),
    average_duration_ms: z.number().nullable(),
  }),
  volume: z.array(z.object({ date: z.string(), users: z.number(), groups: z.number() })),
});

export type DirectoryEventPage = z.infer<typeof eventPageSchema>;

/** `keep`: a list's next page or filter keeps the rows on show while it loads. */
export function useDirectoryEvents(filters: EventFilters, enabled = true, { keep = false } = {}) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQuery({
    queryKey: directoryKeys.events(tenantId, filters),
    queryFn: () =>
      api(`/v1/tenants/${tenantId}/directory/activity`, {
        query: filters,
        schema: eventPageSchema,
      }),
    enabled: !!tenantId && access.can("connection.read") && enabled,
    staleTime: 15_000,
    placeholderData: keep ? keepPreviousData : undefined,
  });
}
