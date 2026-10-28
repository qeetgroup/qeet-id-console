import { describe, expect, it } from "vitest";

import type { OAuthGrant } from "@/modules/authentication/api/oauth-grants";
import type { OidcClient } from "@/modules/authentication/api/oidc-clients";
import type { User } from "@/modules/users";
import { byApplication, joinGrants, matchesGrant, sortGrants } from "../grants-model";

const grant = (id: string, user: string, client: string, issued: string): OAuthGrant => ({
  id,
  client_id: client,
  user_id: user,
  user_email: `${user}@qeet.in`,
  scopes: ["openid", "email"],
  issued_at: issued,
  expires_at: "2026-11-05T00:00:00Z",
});
const GRANTS = [
  grant("g1", "u1", "qci_a", "2026-10-28T09:00:00Z"),
  grant("g2", "u2", "qci_a", "2026-10-28T11:00:00Z"),
  grant("g3", "u1", "qci_gone", "2026-10-27T09:00:00Z"),
];
const USERS = [{ id: "u1", email: "u1@qeet.in", display_name: "Asha Rao" }] as User[];
const CLIENTS = [{ client_id: "qci_a", name: "Qeet Pay", type: "confidential" }] as OidcClient[];

describe("grants", () => {
  it("names each grant's person and application where they're known", () => {
    const [a, b, c] = joinGrants(GRANTS, USERS, CLIENTS);
    expect(a).toMatchObject({ person: "Asha Rao", app: "Qeet Pay", appType: "confidential" });
    expect(b).toMatchObject({ person: "u2@qeet.in", app: "Qeet Pay" });
    expect(c).toMatchObject({ app: "qci_gone", appType: undefined });
  });

  it("filters by application, access and a search of name and email", () => {
    const rows = joinGrants(GRANTS, USERS, CLIENTS);
    expect(rows.filter((r) => matchesGrant(r, { app: "qci_a" })).map((r) => r.id)).toEqual([
      "g1",
      "g2",
    ]);
    expect(rows.filter((r) => matchesGrant(r, { access: "phone" }))).toEqual([]);
    expect(rows.filter((r) => matchesGrant(r, { q: "asha" })).map((r) => r.id)).toEqual([
      "g1",
      "g3",
    ]);
  });

  it("puts the most recently renewed first unless asked otherwise", () => {
    const rows = joinGrants(GRANTS, USERS, CLIENTS);
    expect(sortGrants(rows, null).map((r) => r.id)).toEqual(["g2", "g1", "g3"]);
    expect(
      sortGrants(rows, { column: "person", direction: "ascending" }).map((r) => r.person),
    ).toEqual(["Asha Rao", "Asha Rao", "u2@qeet.in"]);
  });

  it("groups refresh tokens by application, counting people once", () => {
    const [first, second] = byApplication(joinGrants(GRANTS, USERS, CLIENTS));
    expect(first).toMatchObject({
      client_id: "qci_a",
      people: 2,
      renewed: "2026-10-28T11:00:00Z",
    });
    expect(first?.grants).toHaveLength(2);
    expect(second).toMatchObject({ client_id: "qci_gone", people: 1 });
  });
});
