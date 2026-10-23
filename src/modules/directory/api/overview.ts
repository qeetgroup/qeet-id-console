import { useQuery } from "@tanstack/react-query";

import {
  type LdapConnection,
  type ScimConfig,
  useLdapConnections,
  useScimConfig,
} from "@/modules/authentication";
import { groupQueries } from "@/modules/groups";
import { useOrgs } from "@/modules/organizations";
import { invitationQueries, userQueries, useUserStats } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";

type DirectoryInvitation = {
  id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  expires_at: string;
};

type DirectoryGroup = { id: string; parent_id?: string | null };

export function countPendingInvitations(
  invitations: DirectoryInvitation[],
  now = Date.now(),
): number {
  return invitations.filter(
    (invitation) => invitation.status === "pending" && Date.parse(invitation.expires_at) > now,
  ).length;
}

export function summarizeGroups(groups: DirectoryGroup[]) {
  const nested = groups.filter((group) => !!group.parent_id).length;
  return { total: groups.length, topLevel: groups.length - nested, nested };
}

export function summarizeConnections(
  scim: Pick<ScimConfig, "token_set">,
  ldap: Pick<LdapConnection, "status">[],
) {
  const scimEnabled = scim.token_set ? 1 : 0;
  const ldapActive = ldap.filter((connection) => connection.status === "active").length;
  return {
    total: scimEnabled + ldap.length,
    enabled: scimEnabled + ldapActive,
    inactive: ldap.length - ldapActive,
    scimEnabled,
    ldapTotal: ldap.length,
    ldapActive,
  };
}

export function useDirectoryData(includeOverview = true) {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const hasContext = !!tenantId && access.state === "ready";
  const permissions = {
    users: hasContext && access.can("user.read"),
    invitations: hasContext && access.canAll(["user.read", "role.read"]),
    groups: hasContext && access.can("group.read"),
    connections: hasContext && access.can("connection.read"),
    addUser: hasContext && access.canAll(["user.read", "user.write", "role.read", "role.write"]),
    inviteUsers: hasContext && access.canAll(["user.read", "user.write", "role.read"]),
    createGroup: hasContext && access.canAll(["group.read", "group.write"]),
    addConnection: hasContext && access.canAll(["connection.read", "connection.write"]),
    billing: hasContext && access.can("billing.read"),
  };

  const users = useUserStats(permissions.users && includeOverview);
  const organizations = useOrgs(hasContext && includeOverview);
  const scim = useScimConfig(permissions.connections);
  const ldap = useLdapConnections(permissions.connections);
  const invitations = useQuery({
    ...invitationQueries.list(tenantId),
    select: (response) => countPendingInvitations(response.items),
    enabled: permissions.invitations,
    staleTime: 30_000,
  });
  const groups = useQuery({
    ...groupQueries.list(tenantId),
    select: (response) => summarizeGroups(response.items),
    enabled: permissions.groups && includeOverview,
    staleTime: 30_000,
  });
  const deleted = useQuery({
    ...userQueries.deleted(tenantId),
    select: (response) => response.items.length,
    enabled: permissions.users && includeOverview,
    staleTime: 30_000,
  });

  return {
    tenantId,
    accessState: access.state,
    permissions,
    users,
    invitations,
    deleted,
    groups,
    organizations,
    scim,
    ldap,
  };
}

export type DirectoryData = ReturnType<typeof useDirectoryData>;
