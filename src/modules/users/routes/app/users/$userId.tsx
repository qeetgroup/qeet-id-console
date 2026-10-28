import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { USER360_TABS, user360Tab } from "@/modules/users";
import { UserDetailPage } from "@/modules/users/pages";

// Rebuilt on @qeetrix/react: the page draws its own header, with the person's views as its tabs.
// No tab opens Overview; an old `?tab=identities` opens Security, which holds it now.
export const Route = createFileRoute("/_app/users/$userId")({
  staticData: { capability: "user.read", pageHeader: true },
  validateSearch: z.object({ tab: z.preprocess(user360Tab, z.enum(USER360_TABS).optional()) }),
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
        navigate({ search: { tab: next === "overview" ? undefined : next }, replace: true })
      }
    />
  );
}
