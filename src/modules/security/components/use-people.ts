import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { userQueries } from "@/modules/users";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

export type Person = { id: string; name: string; email: string };

/**
 * The people the security lists name by ID (an audit event's actor or subject, a refused sign-in),
 * looked up by those IDs, someone since deleted included. Empty without user.read, and the lists
 * fall back to the ID.
 */
export function usePeople(
  ids: readonly (string | null | undefined)[],
): ReadonlyMap<string, Person> {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  const values = ids.filter((id): id is string => !!id);
  const options = userQueries.lookup(organizationId, { by: "id", values, includeDeleted: true });
  const found = useQuery({
    ...options,
    enabled: options.enabled && access.can("user.read"),
    // The names stay while the next page's are read.
    placeholderData: keepPreviousData,
    meta: { silent: true },
  });
  return useMemo(
    () =>
      new Map(
        (found.data?.items ?? []).map((u) => [
          u.id,
          { id: u.id, name: u.display_name?.trim() || u.email, email: u.email },
        ]),
      ),
    [found.data],
  );
}

/**
 * Everyone in the organisation by ID, for the audit log, whose actor filter offers every person;
 * the Users list's own read, shared through its cache. Empty without user.read.
 */
export function useEveryone(): ReadonlyMap<string, Person> {
  const organizationId = useOrganizationId();
  const access = useCapabilities();
  const options = userQueries.directory(organizationId);
  const directory = useQuery({
    ...options,
    enabled: options.enabled && access.can("user.read"),
    meta: { silent: true },
  });
  return useMemo(
    () =>
      new Map(
        (directory.data?.items ?? []).map((u) => [
          u.id,
          { id: u.id, name: u.display_name?.trim() || u.email, email: u.email },
        ]),
      ),
    [directory.data],
  );
}
