import { describe, expect, it } from "vitest";
import type { LdapConnection, ScimConfig } from "@/modules/authentication";
import {
  buildDirectoryConnections,
  coveragePercent,
  summarizeConnectionHealth,
} from "../directory-model";

const scim: ScimConfig = {
  token_set: true,
  created_at: "2026-09-01T10:00:00Z",
  last_used_at: "2026-09-12T10:00:00Z",
  provisioned_count: 128,
};
const ldap: LdapConnection = {
  id: "ldap-a",
  tenant_id: "tenant-a",
  name: "Corporate directory",
  server_url: "ldaps://directory.example.test",
  start_tls: false,
  skip_tls_verify: false,
  bind_dn: "cn=reader",
  base_dn: "dc=example",
  user_filter: "(uid=%s)",
  email_attribute: "mail",
  name_attribute: "cn",
  status: "active",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  last_login_at: "2026-09-12T11:00:00Z",
};

describe("Directory connections", () => {
  it("combines the configured SCIM endpoint and LDAP connections without inventing telemetry", () => {
    const records = buildDirectoryConnections("tenant-a", scim, [ldap]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ type: "scim", status: "configured", userCount: 128 });
    expect(records[1]).toMatchObject({ type: "ldap", status: "active", userCount: null });
    for (const record of records) {
      expect(record.health).toBe("unknown");
      expect(record.environment).toBeNull();
      expect(record.lastSyncAt).toBeNull();
    }
    expect(summarizeConnectionHealth(records)).toEqual({
      total: 2,
      healthy: null,
      warnings: null,
      failed: null,
      unknown: 2,
      lastSyncAt: null,
    });
  });

  it("does not count an unconfigured SCIM endpoint as a connection", () => {
    expect(
      buildDirectoryConnections("tenant-a", { ...scim, token_set: false }, [ldap]),
    ).toHaveLength(1);
    expect(buildDirectoryConnections("tenant-a", undefined, [])).toEqual([]);
  });

  it("does not substitute last request or sign-in timestamps for successful sync history", () => {
    const records = buildDirectoryConnections("tenant-a", scim, [ldap]);
    expect(records[0]?.lastActivityAt).toBe(scim.last_used_at);
    expect(records[1]?.lastActivityAt).toBe(ldap.last_login_at);
    expect(summarizeConnectionHealth(records).lastSyncAt).toBeNull();
  });

  it("summarizes health only when it is explicitly reported", () => {
    const records = buildDirectoryConnections("tenant-a", scim, [ldap]);
    records[0].health = "healthy";
    records[0].lastSyncAt = "2026-09-12T10:00:00Z";
    records[1].health = "failed";
    expect(summarizeConnectionHealth(records)).toMatchObject({
      healthy: 1,
      warnings: 0,
      failed: 1,
      unknown: 0,
      lastSyncAt: "2026-09-12T10:00:00Z",
    });
  });

  it("keeps missing or inconsistent coverage separate from zero coverage", () => {
    expect(coveragePercent(91, 100)).toBe(91);
    expect(coveragePercent(0, 100)).toBe(0);
    expect(coveragePercent(null, 100)).toBeNull();
    expect(coveragePercent(0, 0)).toBeNull();
    expect(coveragePercent(120, 100)).toBeNull();
    expect(coveragePercent(10, undefined)).toBeNull();
  });
});
