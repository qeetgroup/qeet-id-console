// The sessions view under Users; it shares the data layer and SessionsTable with
// /security/sessions, so the two can't drift apart.
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import {
  type Session,
  SessionsTable,
  useRevokeSession,
  useSessions,
} from "@/modules/authentication";
import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

/** Renders the signed-in sessions list with a confirmed, stepped-up revoke. */
export function UserSessionsPage() {
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
      actionLabel: t("sessions.actionLabel"),
      run: () => revokeM.mutateAsync(s.id),
    }).catch(settleSensitiveAction);

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
