import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { searchEnum } from "@/shared/utils/search-params";

// A person's timeline is their page's Activity view now (user decision, 2026-10-28): an old link
// or bookmark lands there, with its period and filters.
export const Route = createFileRoute("/_app/users/$userId_/timeline")({
  staticData: { capability: "user.read" },
  validateSearch: z.object({
    period: searchEnum(["7d", "30d", "90d"]),
    kind: searchEnum([
      "authentication",
      "authorization",
      "directory",
      "security",
      "developer",
      "system",
    ]),
    result: searchEnum(["failed"]),
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/users/$userId",
      params: { userId: params.userId },
      search: { tab: "activity", ...search },
      replace: true,
    });
  },
});
