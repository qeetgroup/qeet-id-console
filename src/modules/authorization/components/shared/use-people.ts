import type { ComboboxItem } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { type User, userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

/** A person's name as the console shows it: their display name, else their email. */
export function nameOf(user: Pick<User, "display_name" | "email">): string {
  return user.display_name?.trim() || user.email;
}

const NO_ONE: User[] = [];

/**
 * The organisation's people, to name the subjects of checks and tuples (the server returns
 * `user:<uuid>` only) and to pick whom a check is about. Empty without user.read: the tools then
 * take a user ID.
 */
export function usePeople() {
  const canRead = useCapabilities().can("user.read");
  const options = userQueries.directory(useTenantId());
  const directory = useQuery({ ...options, enabled: options.enabled && canRead });
  const people = directory.data?.items ?? NO_ONE;
  return useMemo(() => {
    const byId = new Map(people.map((u) => [u.id, u]));
    const items: ComboboxItem<string>[] = people
      .filter((u) => u.status !== "deleted")
      .map((u) => ({ value: u.id, label: nameOf(u), description: u.email }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      canRead,
      loading: canRead && directory.isPending,
      byId,
      items,
      /** A person's name by id, or null when they aren't in the directory. */
      name: (id: string | null | undefined) => {
        const user = id ? byId.get(id) : undefined;
        return user ? nameOf(user) : null;
      },
    };
  }, [people, canRead, directory.isPending]);
}

/** Returns the person's id in a `user:<id>` subject, or null for any other subject. */
export function userIdOf(subject: string): string | null {
  return subject.startsWith("user:") && !subject.includes("#") ? subject.slice(5) : null;
}
