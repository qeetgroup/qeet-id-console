// What the Dashboard reads now that the area overviews are gone: the directory's failing
// connections, the groups, authorization's risk checks and the members' counts by department,
// team and location (for the organisation's shape). Each source is read only when the person may;
// one they can't read stays `undefined`, so its alerts, set-up rows and panels drop out.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { postureFindings, useAbacPolicies, usePermissions } from "@/modules/authorization";
import { useDirectoryConnections, useDirectoryErrors } from "@/modules/directory";
import { groupQueries } from "@/modules/groups";
import { userQueries } from "@/modules/users";
import { useOrganizationId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  directoryAttention,
  FAILING_FILTERS,
  failingConnections,
  orgShape,
  placesByCountry,
} from "@/modules/dashboard/overview-directory-model";

export function useDirectoryInsights() {
  const access = useCapabilities();
  const organizationId = useOrganizationId();
  const can = {
    users: access.can("user.read"),
    groups: access.can("group.read"),
    roles: access.can("role.read"),
    policies: access.can("policy.read"),
  };

  const errors = useDirectoryErrors(FAILING_FILTERS); // connection.read, checked in the hook
  const connections = useDirectoryConnections();
  const groups = useQuery({
    ...groupQueries.list(organizationId),
    enabled: can.groups && !!organizationId,
  });
  const perms = usePermissions(can.roles);
  const policies = useAbacPolicies(can.policies);
  // The Users band's own read, shared through its cache.
  const stats = useQuery({
    ...userQueries.stats(organizationId),
    enabled: can.users && !!organizationId,
  });

  const failing = useMemo(() => failingConnections(errors.data), [errors.data]);
  const findings = useMemo(
    () =>
      perms.data || policies.data
        ? postureFindings(perms.data?.items ?? [], policies.data?.items ?? [])
        : undefined,
    [perms.data, policies.data],
  );
  const attention = useMemo(
    () =>
      directoryAttention({
        errors: errors.data,
        connections: connections.data,
        groups: groups.data?.items,
        findings,
      }),
    [errors.data, connections.data, groups.data, findings],
  );
  const counts = stats.data;
  const shape = useMemo(() => (counts ? orgShape(counts) : undefined), [counts]);
  const places = useMemo(
    () => (counts ? placesByCountry(counts.by_location) : undefined),
    [counts],
  );

  return {
    attention,
    attentionLoading: [errors, connections, groups, perms, policies].some((q) => q.isLoading),
    /** Failing connections by id, once the errors are in. */
    failing: errors.data ? failing : undefined,
    groups: groups.data?.items,
    setupLoading: [errors, groups, stats].some((q) => q.isLoading),
    /** How many people the organisation has, for the places' shares. */
    people: counts?.total,
    shape,
    places,
  };
}
