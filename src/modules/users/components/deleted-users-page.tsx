import {
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
import { RotateCcwIcon, TrashIcon, UserMinusIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type DeletedUser, useDeletedUsers, usePurgeUser, useRestoreUser } from "../api/users";

/** Renders the recycle bin of soft-deleted users, with restore and permanent deletion. */
export function DeletedUsersPage() {
  const { t } = useTranslation("users");
  const canWriteUsers = useCapabilities().can("user.write");
  const runSensitive = useSensitiveAction();
  const listQ = useDeletedUsers();
  const restoreM = useRestoreUser();
  const purgeM = usePurgeUser();

  // Both are step-up actions on the backend; only the irreversible purge is confirmed.
  const restore = (user: DeletedUser) =>
    runSensitive({
      actionLabel: t("deleted.restoreAction"),
      run: () => restoreM.mutateAsync(user.id),
    }).catch(settleSensitiveAction);
  const purge = (user: DeletedUser) =>
    runSensitive({
      confirm: {
        title: t("deleted.purgeTitle", { email: user.email }),
        description: t("deleted.purgeDescription"),
        confirmLabel: t("deleted.purgeLabel"),
        tone: "destructive",
      },
      actionLabel: t("deleted.purgeAction"),
      run: () => purgeM.mutateAsync(user.id),
    }).catch(settleSensitiveAction);

  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("deleted.description")} />
      {!canWriteUsers ? <ReadOnlyNotice /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>{t("deleted.statLabel")}</CardDescription>
            <UserMinusIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{items.length}</div>
            <p className="text-xs text-muted-foreground">{t("deleted.statHelp")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("deleted.binTitle")}</CardTitle>
          <CardDescription>{t("deleted.binDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={UserMinusIcon}
            emptyTitle={t("deleted.empty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("deleted.colUser")}</TableHead>
                  <TableHead>{t("deleted.colDeleted")}</TableHead>
                  {canWriteUsers ? (
                    <TableHead className="text-right">{t("deleted.colActions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.display_name || u.email}</div>
                      {u.display_name && (
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={u.deleted_at} />
                    </TableCell>
                    {canWriteUsers ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restore(u)}
                          disabled={restoreM.isPending}
                        >
                          <RotateCcwIcon /> {t("deleted.restoreBtn")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => purge(u)}
                          disabled={purgeM.isPending}
                        >
                          <TrashIcon /> {t("deleted.purgeBtn")}
                        </Button>
                      </TableCell>
                    ) : null}
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
