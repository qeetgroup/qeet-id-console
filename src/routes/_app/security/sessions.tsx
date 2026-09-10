import { RefreshArrow } from "@qeetrix/icons";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_app/security/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
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
            <RefreshArrow className={sessionsQ.isFetching ? "animate-spin" : ""} />
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
