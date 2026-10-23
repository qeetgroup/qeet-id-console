import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { LoaderCircleIcon, MonitorSmartphoneIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { StatusPill } from "@/platform/components/status-pill";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type DeviceAuth, useDeviceAuthorizations, useRevokeDeviceAuth } from "../api/device-auth";

/** Renders the OAuth device grants, with revoke. */
export function DeviceAuthorizationsPage() {
  const { t } = useTranslation(["device", "common"]);
  const listQ = useDeviceAuthorizations();
  const revokeM = useRevokeDeviceAuth();
  const runSensitive = useSensitiveAction();

  // Not step-up gated, but it ends a device's access, so it is still a sensitive action.
  const revoke = (d: DeviceAuth) =>
    runSensitive({
      confirm: {
        title: t("revoke.title"),
        description: t("revoke.descriptionPlain", { code: d.user_code }),
        confirmLabel: t("common:actions.revoke"),
        tone: "destructive",
      },
      actionLabel: t("revoke.action"),
      run: () => revokeM.mutateAsync(d.id),
    }).catch(settleSensitiveAction);

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => listQ.refetch()}
            disabled={listQ.isFetching}
          >
            <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
            {t("common:actions.refresh")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.title")}</CardTitle>
          <CardDescription>{t("list.count", { count: items.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={MonitorSmartphoneIcon}
            emptyTitle={t("list.emptyTitle")}
            emptyDescription={t("list.emptyDescription")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.clientId")}</TableHead>
                  <TableHead>{t("table.userCode")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.user")}</TableHead>
                  <TableHead>{t("table.scopes")}</TableHead>
                  <TableHead>{t("table.created")}</TableHead>
                  <TableHead>{t("table.expires")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.client_id.slice(0, 16)}…
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium tracking-wider">
                      {d.user_code}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={d.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.user_email || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.scopes.map((s) => (
                          <Badge key={s} variant="muted">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={d.created_at} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={d.expires_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke(d)}
                        disabled={revokeM.isPending}
                      >
                        {revokeM.isPending && revokeM.variables === d.id ? (
                          <LoaderCircleIcon className="animate-spin" />
                        ) : (
                          <TrashIcon />
                        )}
                        {t("common:actions.revoke")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
