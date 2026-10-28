// OAuth grants as the two pages show them. GET /v1/tenants/{id}/oauth/grants lists each person's
// live refresh token per application (one per client and person: the server returns the current
// link of each rotation chain), with the person's email and the client ID only; names come from
// the Users directory and the applications list where this person may read them.

import type { TableSort } from "@qeetrix/react";

import type { OAuthGrant } from "@/modules/authentication/api/oauth-grants";
import type { OidcClient } from "@/modules/authentication/api/oidc-clients";
import type { User } from "@/modules/users";

/** The access a grant gives, beyond signing in (`openid`), in the order people read it. */
export const ACCESS = ["profile", "email", "phone"] as const;
export type Access = (typeof ACCESS)[number];
export const isAccess = (scope: string): scope is Access => ACCESS.some((a) => a === scope);

export type GrantRow = OAuthGrant & {
  /** The person's name, or their email when the directory doesn't say. */
  person: string;
  /** The application's name, or its client ID when it isn't in the list. */
  app: string;
  appType?: OidcClient["type"];
};

export type GrantFilters = { q?: string; app?: string; access?: Access };

/** Each grant with the names of its person and its application, where they're known. */
export function joinGrants(
  grants: readonly OAuthGrant[],
  users: readonly User[] | undefined,
  clients: readonly OidcClient[] | undefined,
): GrantRow[] {
  const people = new Map((users ?? []).map((u) => [u.id, u]));
  const apps = new Map((clients ?? []).map((c) => [c.client_id, c]));
  return grants.map((g) => {
    const user = people.get(g.user_id);
    const client = apps.get(g.client_id);
    return {
      ...g,
      person: user?.display_name?.trim() || g.user_email || user?.email || g.user_id,
      app: client?.name ?? g.client_id,
      appType: client?.type,
    };
  });
}

/** Whether a grant is in the filtered list: search covers the person's name and email. */
export function matchesGrant(row: GrantRow, filters: GrantFilters): boolean {
  if (filters.app && row.client_id !== filters.app) return false;
  if (filters.access && !row.scopes.includes(filters.access)) return false;
  const q = filters.q?.trim().toLocaleLowerCase();
  if (q && !`${row.person} ${row.user_email}`.toLocaleLowerCase().includes(q)) return false;
  return true;
}

const BY: Record<string, (a: GrantRow, b: GrantRow) => number> = {
  person: (a, b) => a.person.localeCompare(b.person),
  app: (a, b) => a.app.localeCompare(b.app),
  renewed: (a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at),
  ends: (a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at),
};

/** The grants in the chosen order; with none chosen, the most recently renewed first. */
export function sortGrants(rows: GrantRow[], sort: TableSort | null): GrantRow[] {
  const by = (sort && BY[sort.column]) || BY.renewed;
  const sign = sort ? (sort.direction === "ascending" ? 1 : -1) : -1;
  return [...rows].sort((a, b) => sign * (by?.(a, b) ?? 0));
}

/** One application's refresh tokens: how many, for how many people, and when. */
export type AppTokens = {
  client_id: string;
  name: string;
  type?: OidcClient["type"];
  grants: GrantRow[];
  people: number;
  renewed: string; // the latest renewal
  nextEnd: string; // the soonest to end
};

/** The grants by application, the most tokens first. */
export function byApplication(rows: readonly GrantRow[]): AppTokens[] {
  const groups = new Map<string, GrantRow[]>();
  for (const row of rows) groups.set(row.client_id, [...(groups.get(row.client_id) ?? []), row]);
  return [...groups.entries()]
    .map(([clientId, grants]) => ({
      client_id: clientId,
      name: grants[0]?.app ?? clientId,
      type: grants[0]?.appType,
      grants,
      people: new Set(grants.map((g) => g.user_id)).size,
      renewed:
        grants
          .map((g) => g.issued_at)
          .sort()
          .at(-1) ?? "",
      nextEnd: grants.map((g) => g.expires_at).sort()[0] ?? "",
    }))
    .sort((a, b) => b.grants.length - a.grants.length || a.name.localeCompare(b.name));
}

const APP_BY: Record<string, (a: AppTokens, b: AppTokens) => number> = {
  app: (a, b) => a.name.localeCompare(b.name),
  tokens: (a, b) => a.grants.length - b.grants.length,
  people: (a, b) => a.people - b.people,
  renewed: (a, b) => Date.parse(a.renewed) - Date.parse(b.renewed),
};

/** The applications in the chosen order; with none chosen, the most tokens first. */
export function sortApplications(rows: AppTokens[], sort: TableSort | null): AppTokens[] {
  const by = sort && APP_BY[sort.column];
  if (!sort || !by) return rows;
  const sign = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => sign * by(a, b));
}
