import type { LdapConnection, ScimConfig } from "@/modules/authentication";

export type ConnectionHealth = "healthy" | "warning" | "failed" | "unknown";

export type DirectoryConnection = {
  id: string;
  name: string;
  reference: string;
  type: "scim" | "ldap";
  status: "configured" | "active" | "draft" | "disabled";
  health: ConnectionHealth;
  environment: string | null;
  scope: "users-and-groups" | "users-on-signin";
  createdAt: string | null;
  lastActivityAt: string | null;
  lastSyncAt: string | null;
  userCount: number | null;
  groupCount: number | null;
  serverUrl: string | null;
};

export function buildDirectoryConnections(
  tenantId: string,
  scim: ScimConfig | undefined,
  ldap: LdapConnection[],
): DirectoryConnection[] {
  const records: DirectoryConnection[] = ldap.map((connection) => ({
    id: connection.id,
    name: connection.name,
    reference: connection.id,
    type: "ldap",
    status: connection.status,
    health: "unknown",
    environment: null,
    scope: "users-on-signin",
    createdAt: connection.created_at,
    lastActivityAt: connection.last_login_at,
    lastSyncAt: null,
    userCount: null,
    groupCount: null,
    serverUrl: connection.server_url,
  }));

  if (scim?.token_set) {
    records.unshift({
      id: `scim:${tenantId}`,
      name: "SCIM",
      reference: "/scim/v2",
      type: "scim",
      status: "configured",
      health: "unknown",
      environment: null,
      scope: "users-and-groups",
      createdAt: scim.created_at,
      lastActivityAt: scim.last_used_at,
      lastSyncAt: null,
      userCount:
        Number.isSafeInteger(scim.provisioned_count) && scim.provisioned_count >= 0
          ? scim.provisioned_count
          : null,
      groupCount: null,
      serverUrl: null,
    });
  }

  return records;
}

export function summarizeConnectionHealth(connections: DirectoryConnection[]) {
  const reported = connections.some((connection) => connection.health !== "unknown");
  const count = (health: ConnectionHealth) =>
    connections.filter((connection) => connection.health === health).length;
  const syncTimes = connections
    .map((connection) => connection.lastSyncAt)
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
    .sort((first, second) => Date.parse(second) - Date.parse(first));

  return {
    total: connections.length,
    healthy: reported ? count("healthy") : null,
    warnings: reported ? count("warning") : null,
    failed: reported ? count("failed") : null,
    unknown: count("unknown"),
    lastSyncAt: syncTimes[0] ?? null,
  };
}

export function coveragePercent(count: number | null, total: number | undefined): number | null {
  if (count == null || total == null || !Number.isFinite(count) || !Number.isFinite(total)) {
    return null;
  }
  if (total <= 0 || count < 0 || count > total) return null;
  return Math.round((count / total) * 100);
}

export function parseMappingSource(text: string): Record<string, unknown> {
  if (new TextEncoder().encode(text).length > 64000) throw new Error("Source data exceeds 64 KB.");
  const source: unknown = JSON.parse(text);
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error("Source data must be a JSON object.");
  }
  return source as Record<string, unknown>;
}
