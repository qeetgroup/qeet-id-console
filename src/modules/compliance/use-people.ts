// Who the compliance records name: runs and requests carry only user ids, so the names come from
// the Users directory and the Deleted list (both user.read). A deleted person isn't in the
// directory, and `GET /v1/users/{id}` refuses them, so the Deleted list is the only source.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { type User, userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

export type Person = {
  id: string;
  name: string;
  email: string;
  /** The account's home organisation: only it can have the person erased. */
  tenantId?: string;
  /** When they were deleted, for someone in Directory › Deleted. */
  deletedAt?: string;
};

const nameOf = (u: Pick<User, "display_name" | "email">) => u.display_name?.trim() || u.email;

/** Everyone the console can name, by id; `ready` once the lists have loaded (or can't be read). */
export function usePeople() {
  const access = useCapabilities();
  const canRead = access.can("user.read");
  const tenantId = useTenantId();
  const directory = useQuery({
    ...userQueries.directory(tenantId),
    enabled: canRead && !!tenantId,
  });
  const deleted = useQuery({ ...userQueries.deleted(tenantId), enabled: canRead && !!tenantId });
  const active = directory.data?.items;
  const gone = deleted.data?.items;
  const byId = useMemo(() => {
    const map = new Map<string, Person>();
    for (const u of active ?? [])
      map.set(u.id, { id: u.id, name: nameOf(u), email: u.email, tenantId: u.tenant_id });
    for (const u of gone ?? [])
      map.set(u.id, { id: u.id, name: nameOf(u), email: u.email, deletedAt: u.deleted_at });
    return map;
  }, [active, gone]);
  return {
    canRead,
    byId,
    active: active ?? [],
    deleted: gone ?? [],
    ready: !canRead || (!directory.isLoading && !deleted.isLoading),
  };
}
