import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, TooltipProvider } from "@qeetrix/ui";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useRegisterContext } from "@/modules/qeetai";
import { useAnomalies } from "@/modules/security";
import { DataState } from "@/platform/components/data-state";
import { useCapabilities } from "@/platform/security/capability-provider";

import {
  useUserAccess,
  useUserPermissions,
  useUserRecentActivity,
  useUserSecurity,
  useUserSessions,
} from "../api/user360";
import { useUser } from "../api/users";
import { USER360_TABS, type User360Tab } from "../tabs";
import { deriveUserRisk } from "../user-risk";
import { ActivityTab } from "./activity-tab";
import { OverviewTab } from "./overview-tab";
import { AccessTab, DeveloperTab, IdentitiesTab, SecurityTab, SessionsTab } from "./tab-panels";
import { UserDetailHeader } from "./user-detail-header";

/** Renders User 360 for one user: the header and its tabs. */
export function UserDetailPage({
  userId,
  tab,
  onTabChange: setTab,
}: {
  userId: string;
  tab: User360Tab;
  onTabChange: (tab: User360Tab) => void;
}) {
  const { t } = useTranslation("users");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const access = useCapabilities();
  const canWrite = access.can("user.write");
  const canViewActivity = access.can("audit.read");

  const userQ = useUser(userId);

  const securityQ = useUserSecurity(userId);
  const accessQ = useUserAccess(userId);
  const permissionsQ = useUserPermissions(userId);
  const recentQ = useUserRecentActivity(userId, 6, canViewActivity);
  const sessionsQ = useUserSessions(userId);
  const anomaliesQ = useAnomalies();

  // Tells Qeet AI which user is on screen.
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
    const first = items[0];
    if (!first) return null;
    return items.reduce(
      (max, s) => (s.last_seen_at > max ? s.last_seen_at : max),
      first.last_seen_at,
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

        <DataState
          isLoading={userQ.isLoading}
          isError={userQ.isError}
          error={userQ.error}
          loading={<HeaderSkeleton />}
        >
          {userQ.data ? (
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
        </DataState>
      </div>
    </TooltipProvider>
  );
}

function HeaderSkeleton() {
  return (
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
  );
}
