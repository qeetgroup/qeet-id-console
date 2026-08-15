import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, TooltipProvider } from "@qeetrix/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/features/access-control/capability-provider";
import { useRegisterContext } from "@/features/qeetai/context/context-registry";
import { ActivityTab } from "@/features/user360/activity-tab";
import { OverviewTab } from "@/features/user360/overview-tab";
import {
  AccessTab,
  DeveloperTab,
  IdentitiesTab,
  SecurityTab,
  SessionsTab,
} from "@/features/user360/tab-panels";
import { isUser360Tab, USER360_TABS, type User360Tab } from "@/features/user360/tabs";
import { UserDetailHeader } from "@/features/user360/user-detail-header";
import { deriveUserRisk } from "@/features/user360/utils";
import { useAnomalies } from "@/lib/anomalies";
import { api } from "@/lib/api";
import {
  type UserDetail,
  useUserAccess,
  useUserPermissions,
  useUserRecentActivity,
  useUserSecurity,
  useUserSessions,
} from "@/lib/user360";

export const Route = createFileRoute("/_app/users/$userId")({
  // tab is optional so existing `<Link to="/users/$userId">` call sites need not
  // pass a search param; it defaults to the Overview tab.
  validateSearch: (search: Record<string, unknown>): { tab?: User360Tab } => ({
    tab: isUser360Tab(search.tab) ? search.tab : "overview",
  }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { t } = useTranslation("users");
  const { userId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "overview";
  const navigate = Route.useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const access = useCapabilities();
  const canWrite = access.can("user.write");
  const canViewActivity = access.can("audit.read");

  const setTab = (next: User360Tab) =>
    navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });

  const userQ = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api<UserDetail>(`/v1/users/${userId}`),
  });

  const securityQ = useUserSecurity(userId);
  const accessQ = useUserAccess(userId);
  const permissionsQ = useUserPermissions(userId);
  const recentQ = useUserRecentActivity(userId, 6, canViewActivity);
  const sessionsQ = useUserSessions(userId);
  const anomaliesQ = useAnomalies();

  // Publish the current user as the qeetai's selection context (kept from the
  // original page so the assistant still knows which user is on screen).
  const qeetaiCtx = useMemo(
    () => ({ selection: { kind: "user" as const, id: userId, label: userQ.data?.email } }),
    [userId, userQ.data?.email],
  );
  useRegisterContext(pathname, qeetaiCtx);

  const risk = useMemo(
    () => deriveUserRisk(anomaliesQ.data?.items ?? [], userId),
    [anomaliesQ.data, userId],
  );

  const lastSeenAt = useMemo(() => {
    const items = sessionsQ.data?.items ?? [];
    if (items.length === 0) return null;
    return items.reduce(
      (max, s) => (s.last_seen_at > max ? s.last_seen_at : max),
      items[0].last_seen_at,
    );
  }, [sessionsQ.data]);

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-col gap-5">
        <Link
          to="/users"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-3" aria-hidden="true" /> {t("detail.backLink")}
        </Link>

        {userQ.isLoading ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : userQ.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(userQ.error as Error).message}
          </div>
        ) : userQ.data ? (
          <>
            <UserDetailHeader
              user={userQ.data}
              lastSeenAt={lastSeenAt}
              canWrite={canWrite}
              onViewRaw={() => setTab("developer")}
            />

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as User360Tab)}
              className="flex min-w-0 flex-col gap-5"
            >
              <TabsList className="w-full justify-start overflow-x-auto">
                {USER360_TABS.map((k) => (
                  <TabsTrigger key={k} value={k}>
                    {t(`detail.tabs.${k}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="flex min-w-0 flex-col">
                <OverviewTab
                  user={userQ.data}
                  security={securityQ.data}
                  securityLoading={securityQ.isLoading}
                  risk={risk}
                  riskLoading={anomaliesQ.isLoading}
                  access={accessQ.data}
                  accessLoading={accessQ.isLoading}
                  permissionsCount={permissionsQ.data?.permissions.length ?? 0}
                  recent={recentQ.data?.events ?? []}
                  recentLoading={recentQ.isLoading}
                  recentError={recentQ.isError}
                  canWrite={canWrite}
                  canViewActivity={canViewActivity}
                  onTab={setTab}
                />
              </TabsContent>

              <TabsContent value="security" className="flex min-w-0 flex-col">
                <SecurityTab
                  userId={userId}
                  security={securityQ.data}
                  loading={securityQ.isLoading}
                  canWrite={canWrite}
                />
              </TabsContent>

              <TabsContent value="access" className="flex min-w-0 flex-col">
                <AccessTab
                  access={accessQ.data}
                  loading={accessQ.isLoading}
                  permissions={permissionsQ.data?.permissions ?? []}
                  permissionsLoading={permissionsQ.isLoading}
                />
              </TabsContent>

              <TabsContent value="sessions" className="flex min-w-0 flex-col">
                <SessionsTab userId={userId} canWrite={canWrite} />
              </TabsContent>

              <TabsContent value="activity" className="flex min-w-0 flex-col">
                <ActivityTab userId={userId} canView={canViewActivity} />
              </TabsContent>

              <TabsContent value="identities" className="flex min-w-0 flex-col">
                <IdentitiesTab userId={userId} passwordSet={securityQ.data?.password_set} />
              </TabsContent>

              <TabsContent value="developer" className="flex min-w-0 flex-col">
                <DeveloperTab user={userQ.data} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
