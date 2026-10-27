// What the Dashboard reads now that the area overviews are gone: the directory's failing
// connections, the groups, authorization's risk checks and everyone's profile (for the
// organisation's shape). Each source is read only when the person may; one they can't read stays
// `undefined`, so its alerts, set-up rows and panels drop out.
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { postureFindings, useAbacPolicies, usePermissions } from "@/modules/authorization";
import { useDirectoryConnections, useDirectoryErrors } from "@/modules/directory";
import { groupQueries } from "@/modules/groups";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
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
  const tenantId = useTenantId();
  const can = {
    users: access.can("user.read"),
    groups: access.can("group.read"),
    roles: access.can("role.read"),
    policies: access.can("policy.read"),
  };

  const errors = useDirectoryErrors(FAILING_FILTERS); // connection.read, checked in the hook
  const connections = useDirectoryConnections();
  const groups = useQuery({ ...groupQueries.list(tenantId), enabled: can.groups && !!tenantId });
  const perms = usePermissions(can.roles);
  const policies = useAbacPolicies(can.policies);
  const people = useQuery({
    ...userQueries.directory(tenantId),
    enabled: can.users && !!tenantId,
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
  const everyone = people.data?.items;
  const shape = useMemo(() => (everyone ? orgShape(everyone) : undefined), [everyone]);
  const places = useMemo(() => (everyone ? placesByCountry(everyone) : undefined), [everyone]);

  return {
    attention,
    attentionLoading: [errors, connections, groups, perms, policies].some((q) => q.isLoading),
    /** Failing connections by id, once the errors are in. */
    failing: errors.data ? failing : undefined,
    groups: groups.data?.items,
    setupLoading: [errors, groups, people].some((q) => q.isLoading),
    people: everyone,
    shape,
    places,
  };
}
