// Alias view onto the same sessions endpoint used by /security/sessions, framed
// from the Users perspective in the navigation. Shares the sessions data layer
// and SessionsTable so the two views can't drift apart.

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type Session,
  SessionsTable,
  useRevokeSession,
  useSessions,
} from "@/modules/authentication";

export const Route = createFileRoute("/_app/users/sessions")({
  component: UserSessionsPage,
});

function UserSessionsPage() {
  const { t } = useTranslation("users");
  const sessionsQ = useSessions();
  const revokeM = useRevokeSession();
  const runSensitive = useSensitiveAction();

  const revoke = (s: Session) =>
    runSensitive({
      confirm: {
        title: t("sessions.confirmTitle"),
        confirmLabel: t("sessions.confirmLabel"),
        tone: "destructive",
      },
      actionLabel: "revoke this session",
      run: () => revokeM.mutateAsync(s.id),
    }).catch((e) => {
      if (!(e instanceof SensitiveActionCancelled)) throw e;
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("sessions.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => sessionsQ.refetch()}
            disabled={sessionsQ.isFetching}
          >
            <RefreshCwIcon className={sessionsQ.isFetching ? "animate-spin" : ""} />
            {t("sessions.refreshBtn")}
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sessions.title")}</CardTitle>
          <CardDescription>
            {t("sessions.count", { count: sessionsQ.data?.items?.length ?? 0 })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SessionsTable
            query={sessionsQ}
            onRevoke={revoke}
            isRevoking={revokeM.isPending}
            emptyLabel={t("sessions.empty")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
