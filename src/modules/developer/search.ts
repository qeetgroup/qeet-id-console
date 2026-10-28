// The developer lists' addresses, for their routes: light (zod and literals only), as the route
// tree holds them in the shell. Each list reads its filters from here; the band links into them.
import { z } from "zod";

import { searchEnum, searchText } from "@/shared/utils/search-params";

const action = searchEnum(["create"]);

/** Machine access and its tabs: API keys, machine identities, agents. */
export const machineSearch = z.object({
  action,
  q: searchText(),
  kind: searchEnum(["key", "identity", "agent"]),
  status: searchEnum(["active", "expiring", "expired", "revoked", "disabled", "suspended"]),
  used: searchEnum(["today", "week", "month", "older", "never"]),
  reach: searchEnum(["read", "write", "none"]),
  sponsor: searchText(),
  look: searchEnum(["expired", "expiring", "unused", "noScopes", "suspended", "sponsorGone"]),
});

export const secretsSearch = z.object({
  action,
  q: searchText(),
  scope: searchText(),
  changed: searchEnum(["month", "quarter", "year", "older", "never"]),
  look: searchEnum(["stale", "short"]),
});

export const credentialsSearch = z.object({
  action,
  q: searchText(),
  type: searchText(),
  status: searchEnum(["active", "expiring", "expired", "revoked"]),
  look: searchEnum(["noExpiry"]),
});

export const webhooksSearch = z.object({
  action,
  q: searchText(),
  status: searchEnum(["active", "failing", "autoDisabled", "disabled"]),
  area: searchEnum([
    "people",
    "signIn",
    "groups",
    "domains",
    "agents",
    "access",
    "authHooks",
    "logStreams",
    "rateLimits",
    "credentials",
    "applications",
    "organisation",
    "test",
  ]),
  look: searchEnum(["overlap"]),
});
