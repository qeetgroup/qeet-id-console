// The Organisations list's address, apart from its rules (orgs-model.ts): the route tree, in the
// shell, holds this schema, so it stays this small.
import { z } from "zod";

import { searchEnum, searchText } from "@/shared/utils/search-params";

export const ORG_LOOKS = ["below-target", "stale", "suspended", "deleting"] as const;
export type OrgLook = (typeof ORG_LOOKS)[number];

/** The list's address: `?q=…&role=…&plan=…&region=…&look=…`. */
export const orgsListSearch = z.object({
  q: searchText(),
  role: searchText(),
  plan: searchText(),
  region: searchText(),
  look: searchEnum(ORG_LOOKS),
});
export type OrgFilters = z.infer<typeof orgsListSearch>;
