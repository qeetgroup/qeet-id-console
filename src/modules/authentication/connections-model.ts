// Authentication › Connections: the rules every connection page shares, pure so the pages and
// their tests read the same ones. One status vocabulary for every kind (redesign-findings §2):
// Connected · Needs attention · In setup · Turned off · Not set up.

import type { LdapConnection } from "./api/ldap";
import type { SamlConnection } from "./api/saml";
import type { SamlProvider } from "./api/saml-idp";
import type { ScimConfig } from "./api/scim";

const DAY = 86_400_000;

/** How soon before its end a certificate needs attention. */
export const CERTIFICATE_WARNING_DAYS = 30;

export type SetupStatus = "connected" | "attention" | "setup" | "off" | "none";

export const STATUS_TONE: Record<SetupStatus, "success" | "warning" | "info" | "neutral"> = {
  connected: "success",
  attention: "warning",
  setup: "info",
  off: "neutral",
  none: "neutral",
};

/**
 * A SAML or LDAP connection's status: its own (draft, active, disabled), unless something about
 * it needs a look first (a certificate ending, a failing check), which outranks "Connected" and
 * "In setup".
 */
export function connectionStatus(
  status: "draft" | "active" | "disabled" | string,
  needsAttention = false,
): SetupStatus {
  if (status === "disabled") return "off";
  if (needsAttention) return "attention";
  return status === "active" ? "connected" : "setup";
}

/** SCIM is connected once it has a token: the server serves /scim/v2 to whoever holds it. */
export const scimStatus = (scim: Pick<ScimConfig, "token_set"> | undefined): SetupStatus =>
  scim?.token_set ? "connected" : "none";

/** Whether a certificate ending `notAfter` needs attention at `now`: within 30 days, or ended. */
export function certificateEnding(notAfter: Date | null | undefined, now: number): boolean {
  if (!notAfter) return false;
  return notAfter.getTime() - now <= CERTIFICATE_WARNING_DAYS * DAY;
}

// ── The one list of every connection ─────────────────────────────────────────────────────────

/** What a connection does: people sign in through it, it keeps people in sync, or it's an app. */
export type ConnectionGroup = "signin" | "provisioning" | "apps";
export type ConnectionKind = "saml" | "ldap" | "scim" | "app";
export const KIND_GROUP: Record<ConnectionKind, ConnectionGroup> = {
  saml: "signin",
  ldap: "signin",
  scim: "provisioning",
  app: "apps",
};

export type ConnectionRow = {
  id: string;
  kind: ConnectionKind;
  name: string;
  /** Where it points: the provider's or server's host, the SCIM path, the app's host. */
  line: string;
  status: SetupStatus;
  /** Why it needs a look, when it does: a certificate ending, a failing check. */
  problem?: "certificate" | "check";
  lastUsed: string | null;
};

export const CONNECTION_GROUPS = ["signin", "provisioning", "apps"] as const;
export const CONNECTION_SHOWS = ["attention", "setup"] as const;
export type ConnectionListFilters = {
  q?: string;
  type?: (typeof CONNECTION_GROUPS)[number];
  show?: (typeof CONNECTION_SHOWS)[number];
};

/** The host a URL names, or the value itself when it isn't one ("ldap.corp.example.com:636"). */
export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/** The name of the host a URL names, without its port: "ldap.staging.qeet.in". */
export function hostnameOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

/**
 * Every connection in one list: SAML sign-in, LDAP, SCIM (listed once it has a token, else
 * offered under the list) and the SAML apps Qeet ID signs people in to. `certificateEnds` gives a
 * SAML connection's certificate end, read in the browser; `failing` marks the LDAP connections
 * whose latest check failed (the directory's health).
 */
export function connectionRows({
  saml,
  ldap,
  scim,
  apps,
  certificateEnds,
  failing,
  now,
}: {
  saml: readonly SamlConnection[];
  ldap: readonly LdapConnection[];
  scim?: ScimConfig;
  apps: readonly SamlProvider[];
  certificateEnds: (c: SamlConnection) => Date | null;
  failing: ReadonlySet<string>;
  now: number;
}): ConnectionRow[] {
  const rows: ConnectionRow[] = [];
  for (const c of saml) {
    const ending = c.status !== "disabled" && certificateEnding(certificateEnds(c), now);
    rows.push({
      id: c.id,
      kind: "saml",
      name: c.name,
      line: hostOf(c.idp_sso_url),
      status: connectionStatus(c.status, ending),
      problem: ending ? "certificate" : undefined,
      lastUsed: c.last_login_at,
    });
  }
  for (const c of ldap) {
    const fails = c.status !== "disabled" && failing.has(c.id);
    rows.push({
      id: c.id,
      kind: "ldap",
      name: c.name,
      line: hostOf(c.server_url),
      status: connectionStatus(c.status, fails),
      problem: fails ? "check" : undefined,
      lastUsed: c.last_login_at,
    });
  }
  if (scim?.token_set)
    rows.push({
      id: "scim",
      kind: "scim",
      name: "",
      line: "/scim/v2",
      status: "connected",
      lastUsed: scim.last_used_at,
    });
  for (const a of apps)
    rows.push({
      id: a.id,
      kind: "app",
      name: a.name,
      line: hostOf(a.acs_url),
      status: connectionStatus(a.status),
      lastUsed: a.last_login_at,
    });
  return rows;
}

/** The rows the address shows: a group, a "needs a look" view, and a search on name and host. */
export function shownRows(
  rows: readonly ConnectionRow[],
  filters: ConnectionListFilters,
  nameOf: (row: ConnectionRow) => string,
): ConnectionRow[] {
  const q = filters.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!filters.type || KIND_GROUP[r.kind] === filters.type) &&
      (!filters.show || r.status === filters.show) &&
      (!q || nameOf(r).toLowerCase().includes(q) || r.line.toLowerCase().includes(q)),
  );
}

/** Newest first by last use; never used last. */
export function byLastUsed(rows: readonly ConnectionRow[], direction: "ascending" | "descending") {
  const at = (r: ConnectionRow) => (r.lastUsed ? Date.parse(r.lastUsed) : 0);
  return [...rows].sort((a, b) => (direction === "descending" ? at(b) - at(a) : at(a) - at(b)));
}

// ── Setup links (the admin portal) ───────────────────────────────────────────────────────────

/** The server keeps a link between 15 minutes and 24 hours; it shortens anything longer. */
export const SETUP_LINK_TTLS = [3_600, 4 * 3_600, 24 * 3_600] as const;
export const DEFAULT_SETUP_LINK_TTL = 24 * 3_600;

export type SetupLinkState = "active" | "expired" | "revoked";
export function setupLinkState(
  link: { revoked_at: string | null; expires_at: string },
  now: number,
): SetupLinkState {
  if (link.revoked_at) return "revoked";
  return Date.parse(link.expires_at) > now ? "active" : "expired";
}

// ── A directory connection's events (tests and sign-ins) ─────────────────────────────────────

type ConnectionEvent = {
  operation: string;
  status: "success" | "warning" | "failed";
  started_at: string;
  message: string;
};

/** A connection's latest test: the newest "test" event. */
export function latestTest<E extends ConnectionEvent>(events: readonly E[]): E | undefined {
  return [...events]
    .filter((e) => e.operation === "test")
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
}

/** What went wrong, without the address the server's message starts with ("no such host"). */
export const eventReason = (event: Pick<ConnectionEvent, "message">) =>
  event.message.split(": ").pop() ?? event.message;

/** Sign-ins a day for `days` days, oldest first: those that worked and those that failed. */
export function signInDays(
  events: readonly ConnectionEvent[],
  now: number,
  days = 30,
): { date: string; ok: number; failed: number }[] {
  const byDate = new Map<string, { ok: number; failed: number }>();
  for (const e of events) {
    if (e.operation !== "sign-in") continue;
    const date = new Date(e.started_at).toISOString().slice(0, 10);
    const day = byDate.get(date) ?? { ok: 0, failed: 0 };
    if (e.status === "success") day.ok++;
    else day.failed++;
    byDate.set(date, day);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - 1 - i) * DAY).toISOString().slice(0, 10);
    return { date, ...(byDate.get(date) ?? { ok: 0, failed: 0 }) };
  });
}

// ── LDAP ─────────────────────────────────────────────────────────────────────────────────────

/**
 * How Qeet ID talks to the directory: ldaps:// is TLS from the start; ldap:// with StartTLS
 * upgrades the connection before binding; plain ldap:// sends the passwords unencrypted.
 */
export type LdapEncryption = "ldaps" | "starttls" | "none";
export function ldapEncryption(
  c: Pick<LdapConnection, "server_url" | "start_tls">,
): LdapEncryption {
  if (c.server_url.trim().toLowerCase().startsWith("ldaps://")) return "ldaps";
  return c.start_tls ? "starttls" : "none";
}

/** The LDAP filter with a sample name in place of %s, as the server searches for it. */
export const filterFor = (filter: string, name: string) => filter.replaceAll("%s", name);
