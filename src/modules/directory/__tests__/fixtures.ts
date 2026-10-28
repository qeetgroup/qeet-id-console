// Shared records for the Sync activity, Sync errors and Mappings tests, shaped as the server
// sends them (internal/federation/directory).
import type { DirectoryEvent } from "../api/directory";

const DAY = 86_400_000;
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/** A directory connection as GET /directory/connections lists it. */
export const record = (patch: Record<string, unknown> = {}) => ({
  id: "st",
  name: "Staging Directory (test)",
  reference: "st",
  type: "ldap",
  status: "draft",
  health: "unknown",
  environment: null,
  scope: "users-on-signin",
  created_at: ago(20 * DAY),
  last_activity_at: null,
  last_sync_at: null,
  user_count: null,
  group_count: null,
  server_url: "ldaps://ldap.staging.qeet.in:636",
  ...patch,
});

/** A failed LDAP connection check, open and retryable, as the seeded Qeet Group has three. */
export const check = (patch: Partial<DirectoryEvent> = {}): DirectoryEvent => ({
  id: "e1",
  connection_id: "st",
  operation: "test",
  trigger: "manual",
  resource_type: "connection",
  resource_id: "",
  started_at: ago(6 * DAY),
  duration_ms: 14366,
  http_status: 502,
  status: "failed",
  users_synced: 0,
  groups_synced: 0,
  error_code: "DIR-502",
  message: "ldaps://ldap.staging.qeet.in:636: no such host",
  category: "connection",
  severity: "critical",
  resolution: "open",
  resolved_at: null,
  retry_of: null,
  retryable: true,
  ...patch,
});

/** A SCIM change that went through: a person added. */
export const push = (patch: Partial<DirectoryEvent> = {}): DirectoryEvent => ({
  ...check(),
  id: "p1",
  connection_id: "scim:t1",
  operation: "post",
  trigger: "push",
  resource_type: "user",
  started_at: ago(2 * 3_600_000),
  duration_ms: 180,
  http_status: 201,
  status: "success",
  users_synced: 1,
  error_code: "",
  message: "Operation completed",
  category: "",
  severity: "",
  retryable: false,
  ...patch,
});

export const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  limit: 25,
  offset: 0,
  ...extra,
});
