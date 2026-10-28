import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

export type Person = { id: string; name: string; email: string };

/**
 * Everyone in the organisation by ID, to name the people the security lists only know by ID
 * (an audit event's actor, a refused sign-in). The Users list's own read, shared through its
 * cache; empty without user.read, and the lists fall back to the ID.
 */
export function usePeople(): ReadonlyMap<string, Person> {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const options = userQueries.directory(tenantId);
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
