import { describe, expect, it } from "vitest";

import type { LdapConnection } from "@/modules/authentication/api/ldap";
import type { OidcClient } from "@/modules/authentication/api/oidc-clients";
import type { SamlConnection } from "@/modules/authentication/api/saml";
import type { SamlProvider } from "@/modules/authentication/api/saml-idp";
import {
  fingerprint,
  readCertificate,
  shortFingerprint,
} from "@/modules/authentication/certificate-model";
import {
  byLastUsed,
  certificateEnding,
  connectionRows,
  connectionStatus,
  eventReason,
  latestTest,
  ldapEncryption,
  setupLinkState,
  shownRows,
  signInDays,
} from "@/modules/authentication/connections-model";
import {
  appKind,
  appStatus,
  peopleByClient,
  shownApps,
  signsInAt,
} from "@/modules/authentication/oidc-apps-model";
import { OKTA_CERT } from "./fixtures";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-28T12:00:00Z");

const saml = (over: Partial<SamlConnection> = {}): SamlConnection => ({
  id: "s1",
  tenant_id: "t1",
  name: "Okta",
  idp_entity_id: "http://www.okta.com/exk1",
  idp_sso_url: "https://acme.okta.com/app/sso/saml",
  idp_certificate: OKTA_CERT,
  email_attribute: "email",
  name_attribute: "name",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: "2026-10-27T12:00:00Z",
  ...over,
});
const ldap = (over: Partial<LdapConnection> = {}): LdapConnection => ({
  id: "l1",
  tenant_id: "t1",
  name: "Staging Directory",
  server_url: "ldaps://ldap.staging.qeet.in:636",
  start_tls: false,
  skip_tls_verify: false,
  bind_dn: "cn=svc",
  base_dn: "ou=people",
  user_filter: "(uid=%s)",
  email_attribute: "mail",
  name_attribute: "cn",
  status: "draft",
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
  last_login_at: null,
  ...over,
});
const app = (over: Partial<SamlProvider> = {}): SamlProvider => ({
  id: "a1",
  tenant_id: "t1",
  name: "Slack",
  entity_id: "https://slack.com",
  acs_url: "https://acme.slack.com/sso/saml",
  name_id_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  name_id_attribute: "email",
  certificate: "",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  last_login_at: "2026-10-26T12:00:00Z",
  ...over,
});
const client = (over: Partial<OidcClient> = {}): OidcClient => ({
  id: "c1",
  tenant_id: "t1",
  client_id: "qci_support",
  name: "Support Desk",
  type: "confidential",
  redirect_uris: ["https://support.qeet.in/callback"],
  post_logout_uris: [],
  grant_types: ["authorization_code", "refresh_token"],
  scopes: ["openid"],
  created_at: "2025-10-21T00:00:00Z",
  ...over,
});

describe("a signing certificate, read in the browser", () => {
  it("reads whom it names and when it ends, from PEM or bare base64", () => {
    const facts = readCertificate(OKTA_CERT);
    expect(facts?.subject).toBe("Okta IdP");
    expect(facts?.notAfter.toISOString()).toBe("2036-10-25T13:38:07.000Z");
    const bare = OKTA_CERT.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    expect(readCertificate(bare)?.notBefore.toISOString()).toBe("2026-10-28T13:38:07.000Z");
  });

  it("refuses what isn't a certificate", () => {
    expect(readCertificate("")).toBeNull();
    expect(readCertificate("not base64 at all!")).toBeNull();
    expect(readCertificate("aGVsbG8gd29ybGQ=")).toBeNull();
  });

  it("gives its SHA-256 fingerprint as people compare it", async () => {
    const facts = readCertificate(OKTA_CERT);
    const print = await fingerprint(facts?.der ?? new Uint8Array());
    expect(print).toBe(
      "2A:00:B2:65:C9:13:B0:CD:A0:E2:E5:F8:B3:A5:EC:0D:2D:7D:9F:89:A1:80:EF:1F:C2:1E:75:D5:F9:D6:B8:03",
    );
    expect(shortFingerprint(print)).toBe("2A:00:B2:65…B8:03");
  });

  it("needs attention within 30 days of its end, and once it has ended", () => {
    const end = new Date(NOW + 31 * DAY);
    expect(certificateEnding(end, NOW)).toBe(false);
    expect(certificateEnding(end, NOW + 2 * DAY)).toBe(true);
    expect(certificateEnding(end, NOW + 40 * DAY)).toBe(true);
    expect(certificateEnding(null, NOW)).toBe(false);
  });
});

describe("one status vocabulary", () => {
  it("words a connection's own status, a problem outranking Connected and In setup", () => {
    expect(connectionStatus("active")).toBe("connected");
    expect(connectionStatus("draft")).toBe("setup");
    expect(connectionStatus("disabled")).toBe("off");
    expect(connectionStatus("active", true)).toBe("attention");
    expect(connectionStatus("draft", true)).toBe("attention");
    expect(connectionStatus("disabled", true)).toBe("off");
  });
});

describe("every connection in one list", () => {
  const rows = (over: Partial<Parameters<typeof connectionRows>[0]> = {}) =>
    connectionRows({
      saml: [saml()],
      ldap: [ldap()],
      scim: { token_set: false, created_at: null, last_used_at: null, provisioned_count: 0 },
      apps: [app(), app({ id: "a2", name: "AWS", status: "draft", last_login_at: null })],
      certificateEnds: (c) => readCertificate(c.idp_certificate)?.notAfter ?? null,
      failing: new Set(),
      now: NOW,
      ...over,
    });

  it("lists SAML, LDAP and the apps, and SCIM only once it has a token", () => {
    expect(rows().map((r) => `${r.kind}:${r.status}`)).toEqual([
      "saml:connected",
      "ldap:setup",
      "app:connected",
      "app:setup",
    ]);
    const withScim = rows({
      scim: { token_set: true, created_at: null, last_used_at: null, provisioned_count: 3 },
    });
    expect(withScim.find((r) => r.kind === "scim")).toMatchObject({
      status: "connected",
      line: "/scim/v2",
    });
  });

  it("marks a failing directory and a certificate ending soon as needing attention", () => {
    const r = rows({ failing: new Set(["l1"]), now: Date.parse("2036-10-15T00:00:00Z") });
    expect(r.find((x) => x.kind === "ldap")).toMatchObject({
      status: "attention",
      problem: "check",
    });
    expect(r.find((x) => x.kind === "saml")).toMatchObject({
      status: "attention",
      problem: "certificate",
    });
  });

  it("narrows by group, view and search, and sorts by last use with never last", () => {
    const all = rows();
    const name = (r: { name: string }) => r.name;
    expect(shownRows(all, { type: "apps" }, name).map(name)).toEqual(["Slack", "AWS"]);
    expect(shownRows(all, { show: "setup" }, name).map(name)).toEqual(["Staging Directory", "AWS"]);
    expect(shownRows(all, { q: "okta" }, name).map(name)).toEqual(["Okta"]);
    expect(byLastUsed(all, "descending").map(name)).toEqual([
      "Okta",
      "Slack",
      "Staging Directory",
      "AWS",
    ]);
  });

  it("says whether a setup link is open, ended or revoked", () => {
    const at = (days: number) => new Date(NOW + days * DAY).toISOString();
    expect(setupLinkState({ revoked_at: null, expires_at: at(1) }, NOW)).toBe("active");
    expect(setupLinkState({ revoked_at: null, expires_at: at(-1) }, NOW)).toBe("expired");
    expect(setupLinkState({ revoked_at: at(-2), expires_at: at(1) }, NOW)).toBe("revoked");
  });
});

describe("a directory connection's events", () => {
  const event = (operation: string, status: "success" | "failed", daysAgo: number) => ({
    operation,
    status,
    started_at: new Date(NOW - daysAgo * DAY).toISOString(),
    message: "ldaps://ldap.staging.qeet.in:636: no such host",
  });

  it("finds the latest test and words its reason without the address", () => {
    const last = latestTest([
      event("test", "failed", 8),
      event("sign-in", "success", 1),
      event("test", "success", 3),
    ]);
    expect(last).toMatchObject({ status: "success" });
    expect(eventReason(event("test", "failed", 1))).toBe("no such host");
  });

  it("counts sign-ins a day for 30 days, oldest first", () => {
    const days = signInDays(
      [
        event("sign-in", "success", 0),
        event("sign-in", "failed", 0),
        event("sign-in", "success", 2),
        event("test", "failed", 0),
      ],
      NOW,
    );
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toMatchObject({ ok: 1, failed: 1 });
    expect(days.at(-3)).toMatchObject({ ok: 1, failed: 0 });
  });

  it("says how Qeet ID talks to the directory", () => {
    expect(ldapEncryption(ldap())).toBe("ldaps");
    expect(ldapEncryption(ldap({ server_url: "ldap://ad.corp:389", start_tls: true }))).toBe(
      "starttls",
    );
    expect(ldapEncryption(ldap({ server_url: "ldap://ad.corp:389" }))).toBe("none");
  });
});

describe("applications", () => {
  it("works out what kind of app each is", () => {
    expect(appKind(client())).toBe("web");
    expect(appKind(client({ type: "public", redirect_uris: ["http://localhost:3020/cb"] }))).toBe(
      "spa",
    );
    expect(appKind(client({ type: "public", redirect_uris: ["in.qeet.mobile:/oauth2"] }))).toBe(
      "mobile",
    );
    expect(
      appKind(
        client({ grant_types: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"] }),
      ),
    ).toBe("cli");
    expect(
      appKind(client({ grant_types: ["urn:ietf:params:oauth:grant-type:token-exchange"] })),
    ).toBe("service");
  });

  it("says where it signs people in", () => {
    expect(signsInAt(client())).toBe("support.qeet.in");
    expect(signsInAt(client({ redirect_uris: ["in.qeet.mobile:/oauth2"] }))).toBe("in.qeet.mobile");
    expect(signsInAt(client({ redirect_uris: [] }))).toBeNull();
  });

  it("gives one status, the proof-key exemption first", () => {
    const now = new Date(NOW);
    const until = new Date(NOW + 40 * DAY).toISOString();
    expect(appStatus(client({ pkce_exempt_until: until }), now)).toMatchObject({
      kind: "pkceExempt",
      endingSoon: false,
    });
    expect(
      appStatus(client({ pkce_exempt_until: new Date(NOW - DAY).toISOString() }), now).kind,
    ).toBe("pkceEnded");
    expect(appStatus(client({ redirect_uris: ["http://localhost:3010/cb"] }), now).kind).toBe(
      "localhost",
    );
    expect(appStatus(client(), now).kind).toBe("active");
  });

  it("counts the people signed in to each app, once each", () => {
    const grant = (client_id: string, user_id: string) => ({
      id: `${client_id}-${user_id}`,
      client_id,
      user_id,
      user_email: "",
      scopes: [],
      issued_at: "",
      expires_at: "",
    });
    const people = peopleByClient([
      grant("a", "u1"),
      grant("a", "u1"),
      grant("a", "u2"),
      grant("b", "u1"),
    ]);
    expect(people.get("a")).toBe(2);
    expect(people.get("b")).toBe(1);
  });

  it("narrows by kind and searches name and client ID", () => {
    const list = [
      client(),
      client({
        id: "c2",
        client_id: "qci_cli",
        name: "CLI",
        type: "public",
        grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
        redirect_uris: [],
      }),
    ];
    expect(shownApps(list, { kind: "cli" }).map((c) => c.name)).toEqual(["CLI"]);
    expect(shownApps(list, { q: "qci_sup" }).map((c) => c.name)).toEqual(["Support Desk"]);
  });
});
