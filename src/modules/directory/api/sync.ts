// What only Sync activity and Sync errors load, apart from the directory's reads (directory.ts,
// which the shell carries through the Dashboard): each connection's month, and their changes.
//
// Server facts (internal/federation/directory): marking a failure resolved only records who and
// when; nothing changes on the connection. A retry is offered only for an open, failed LDAP
// connection check (`retryable`): it runs the check again, and closes the failure ("retried") when
// it passes, or leaves it open when it fails. An alert belongs to the person who makes it: when a
// connection's failures in 15 minutes reach its threshold, that person gets a console notification
// (at most one every 15 minutes). Neither needs a step-up; each needs connection.write.

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  DEFAULT_EVENT_FILTERS,
  type DirectoryEvent,
  type ErrorFilters,
  type EventFilters,
  errorPageSchema,
} from "./directory";
import { eventPageSchema } from "./events";
import { directoryKeys } from "./keys";

/** Each connection's events over `days`: one short read a connection, for its total and failures. */
export function useEventsByConnection(connectionIds: readonly string[], days: number) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  return useQueries({
    queries: connectionIds.map((id) => {
      // The same shape as useDirectoryEvents' filters, so a matching read shares its cache.
      const filters: EventFilters = { ...DEFAULT_EVENT_FILTERS, days, connection_id: id, limit: 1 };
      return {
        queryKey: directoryKeys.events(tenantId, filters),
        queryFn: () =>
          api(`/v1/tenants/${tenantId}/directory/activity`, {
            query: filters,
            schema: eventPageSchema,
          }),
        enabled: !!tenantId && access.can("connection.read"),
        staleTime: 15_000,
      };
    }),
  });
}

export type ErrorAction = "retry" | "resolve";

/** How a run of retries or resolves went: closed (passed or marked), still open, refused. */
export type ErrorActionResult = { closed: number; stillOpen: number; refused: number };

/**
 * Retries or resolves failures one at a time. A retry that runs but fails again leaves the failure
 * open; one the server refuses (already closed, not retryable) is counted, not thrown.
 */
export function useDirectoryErrorAction() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      events,
      action,
    }: {
      events: readonly DirectoryEvent[];
      action: ErrorAction;
    }): Promise<ErrorActionResult> => {
      const result: ErrorActionResult = { closed: 0, stillOpen: 0, refused: 0 };
      for (const event of events) {
        try {
          const response = await api(
            `/v1/tenants/${tenantId}/directory/errors/${encodeURIComponent(event.id)}/${action}`,
            { method: "POST", schema: z.object({ succeeded: z.boolean() }) },
          );
          if (response.succeeded) result.closed++;
          else result.stillOpen++;
        } catch (err) {
          // One refusal among several is a count; a run where every call fails is an error.
          if (events.length === 1) throw err;
          result.refused++;
        }
      }
      return result;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: directoryKeys.tenant(tenantId) }),
    meta: { silent: true }, // the page says how it went
  });
}

/** An alert for the person making it, on one connection or any; see the file's comment. */
export function useCreateDirectoryAlert() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (body: { name: string; connection_id: string | null; threshold: number }) =>
      api(`/v1/tenants/${tenantId}/directory/alerts`, { method: "POST", body }),
    meta: { successMessage: "directory:toast.alertCreated", silentError: true }, // the dialog shows an error
  });
}

/** Thrown when an export would pass the 10,000 rows it reads: narrow the list first. */
export class ExportTooLargeError extends Error {
  constructor() {
    super("Directory export over 10,000 rows");
    this.name = "ExportTooLargeError";
  }
}

const EXPORT_CAP = 10_000;

/** Every event on the list's filters, a hundred at a time, for a CSV. */
export async function fetchActivityExport(tenantId: string, filters: EventFilters) {
  const records: DirectoryEvent[] = [];
  for (let offset = 0; offset < EXPORT_CAP; offset += 100) {
    const page = await api(`/v1/tenants/${tenantId}/directory/activity`, {
      query: { ...filters, limit: 100, offset },
      schema: eventPageSchema,
    });
    if (page.total > EXPORT_CAP) throw new ExportTooLargeError();
    records.push(...page.items);
    if (records.length >= page.total || page.items.length === 0) break;
  }
  return records;
}

/** Every failure on the list's filters, a hundred at a time, for a CSV. */
export async function fetchErrorsExport(tenantId: string, filters: ErrorFilters) {
  const records: DirectoryEvent[] = [];
  for (let offset = 0; offset < EXPORT_CAP; offset += 100) {
    const page = await api(`/v1/tenants/${tenantId}/directory/errors`, {
      query: { ...filters, limit: 100, offset },
      schema: errorPageSchema,
    });
    if (page.total > EXPORT_CAP) throw new ExportTooLargeError();
    records.push(...page.items);
    if (records.length >= page.total || page.items.length === 0) break;
  }
  return records;
}
