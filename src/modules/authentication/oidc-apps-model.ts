// Applications (OpenID Connect clients): what kind of app each is, where it signs people in, its
// one status, and how many people are signed in to it. Pure, so the list, an app's page and their
// tests read the same rules.

import type { OAuthGrant } from "./api/oauth-grants";
import { type OidcClient, proofKeyStatus } from "./api/oidc-clients";

export const APP_KINDS = ["web", "spa", "mobile", "cli", "service"] as const;
export type AppKind = (typeof APP_KINDS)[number];

const DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code";
const TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";

function isWebUrl(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

/**
 * What kind of app it is, from what the server stores: a device-code app runs on the command
 * line; one with no browser sign-in (token exchange) is a service; a public app that returns to
 * a custom scheme is a mobile app, to a web address a single-page app; a confidential one with a
 * browser sign-in is a web app.
 */
export function appKind(
  client: Pick<OidcClient, "type" | "grant_types" | "redirect_uris">,
): AppKind {
  if (client.grant_types.includes(DEVICE_CODE)) return "cli";
  if (!client.grant_types.includes("authorization_code")) return "service";
  if (client.type === "public") {
    const first = client.redirect_uris[0];
    return first && !isWebUrl(first) ? "mobile" : "spa";
  }
  return "web";
}

export const isLoopback = (uri: string) => {
  try {
    const host = new URL(uri).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
};

/** Where the app sends people back to: a host, a mobile app's scheme, or none. */
export function signsInAt(client: Pick<OidcClient, "redirect_uris">): string | null {
  const first = client.redirect_uris[0];
  if (!first) return null;
  if (!isWebUrl(first)) return first.split(":")[0] ?? first;
  try {
    return new URL(first).host;
  } catch {
    return first;
  }
}

/**
 * One status, the most specific first: its exemption from sending a proof key (on, or ended so
 * its sign-ins now fail); every address on this computer (it can't sign anyone in elsewhere);
 * else active.
 */
export type AppStatus =
  | { kind: "pkceExempt"; until: Date; endingSoon: boolean }
  | { kind: "pkceEnded"; until: Date }
  | { kind: "localhost" }
  | { kind: "active" };

export function appStatus(client: OidcClient, now: Date = new Date()): AppStatus {
  const proof = proofKeyStatus(client, now);
  if (proof.kind === "exempt")
    return { kind: "pkceExempt", until: proof.until, endingSoon: proof.endingSoon };
  if (proof.kind === "ended") return { kind: "pkceEnded", until: proof.until };
  if (client.redirect_uris.length && client.redirect_uris.every(isLoopback))
    return { kind: "localhost" };
  return { kind: "active" };
}

/**
 * The people signed in to each app now: those holding its live refresh grant (the server lists the
 * current refresh token of each person's sign-in to an app). By the app's client ID.
 */
export function peopleByClient(grants: readonly OAuthGrant[]): Map<string, number> {
  const people = new Map<string, Set<string>>();
  for (const g of grants) {
    const set = people.get(g.client_id) ?? new Set<string>();
    set.add(g.user_id);
    people.set(g.client_id, set);
  }
  return new Map([...people].map(([client, set]) => [client, set.size]));
}

/** A grant type in the words a person reads. */
export type GrantWord = "browser" | "refresh" | "device" | "exchange" | "other";
export function grantWord(grant: string): GrantWord {
  if (grant === "authorization_code") return "browser";
  if (grant === "refresh_token") return "refresh";
  if (grant === DEVICE_CODE) return "device";
  if (grant === TOKEN_EXCHANGE) return "exchange";
  return "other";
}

export type AppFilters = { q?: string; kind?: AppKind };

/** The apps the address shows: one kind, and a search on name and client ID. */
export function shownApps(clients: readonly OidcClient[], filters: AppFilters): OidcClient[] {
  const q = filters.q?.trim().toLowerCase();
  return clients.filter(
    (c) =>
      (!filters.kind || appKind(c) === filters.kind) &&
      (!q || c.name.toLowerCase().includes(q) || c.client_id.toLowerCase().includes(q)),
  );
}

/** Splits a list typed one a line, or comma- or space-separated, into its values. */
export function splitList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
