import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type Session,
  SessionsTable,
  useRevokeSession,
  useSessions,
} from "@/modules/authentication";

/** Renders the signed-in person's sessions, with revoke. */
export function SecuritySessionsPage() {
  const { t } = useTranslation("security");
  const sessionsQ = useSessions();
  const revokeM = useRevokeSession();
  const runSensitive = useSensitiveAction();
  const itemCount = sessionsQ.data?.items?.length ?? 0;

  const revoke = (s: Session) =>
    runSensitive({
      confirm: {
        title: t("sessions.confirm.revokeTitle"),
        confirmLabel: t("sessions.confirm.revokeLabel"),
        tone: "destructive",
      },
      actionLabel: t("sessions.confirm.revokeAction").toLowerCase(),
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
            {t("sessions.refresh")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sessions.list.title")}</CardTitle>
          <CardDescription>{t("sessions.list.count", { count: itemCount })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SessionsTable
            query={sessionsQ}
            onRevoke={revoke}
            isRevoking={revokeM.isPending}
            emptyLabel={t("sessions.list.empty")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
