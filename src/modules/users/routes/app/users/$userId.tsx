import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { USER360_TABS } from "@/modules/users";
import { UserDetailPage } from "@/modules/users/pages";
import { searchEnum } from "@/shared/utils/search-params";

export const Route = createFileRoute("/_app/users/$userId")({
  staticData: { capability: "user.read" },
  validateSearch: z.object({ tab: searchEnum(USER360_TABS) }), // no tab opens Overview
  component: UserDetailRoute,
});

function UserDetailRoute() {
  const { userId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "overview";
  const navigate = Route.useNavigate();
  return (
    <UserDetailPage
      userId={userId}
      tab={tab}
      onTabChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true })
      }
    />
  );
}
