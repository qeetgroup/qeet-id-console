import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import {
  LoaderCircleIcon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { roleQueries } from "@/modules/authorization";
import { useTenantId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { ReadOnlyNotice } from "@/platform/security/read-only-notice";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";
import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

import {
  type Invitation,
  useInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from "../api/invitations";
import { InviteSheet } from "./invite-sheet";

/** Renders the organization's invitations, with resend, revoke and the send sheet. */
export function InvitationsPage() {
  const { t } = useTranslation("invitations");
  const access = useCapabilities();
  const canWriteUsers = access.can("user.write");
  const canReadRoles = access.can("role.read");
  const canCreateInvites = canWriteUsers && canReadRoles;
  const [creating, setCreating] = useCreateIntent(canCreateInvites);
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const tenantId = useTenantId();

  useEffect(() => {
    if (!canCreateInvites) setCreating(false);
    // setCreating is a useState setter, so it is stable and never re-triggers this.
  }, [canCreateInvites, setCreating]);

  const listQ = useInvitations(canReadRoles);
  const rolesQ = useQuery(roleQueries.list(tenantId));
  const revokeM = useRevokeInvitation();
  const resendM = useResendInvitation();

  const roleName = (id?: string | null) => rolesQ.data?.items.find((r) => r.id === id)?.name ?? "—";

  const items = listQ.data?.items ?? [];
  const lv = useListView(items, {
    searchFields: (inv) => [inv.email, roleName(inv.role_id)],
    filterFields: { status: (inv) => inv.status },
    sortFields: {
      email: (inv) => inv.email,
      expires: (inv) => inv.expires_at,
      sent: (inv) => inv.created_at,
    },
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const inviteCsvColumns: CsvColumn<Invitation>[] = [
    { header: "id", value: (inv) => inv.id },
    { header: "email", value: (inv) => inv.email },
    { header: "role", value: (inv) => roleName(inv.role_id) },
    { header: "status", value: (inv) => inv.status },
    { header: "expires_at", value: (inv) => inv.expires_at },
    { header: "created_at", value: (inv) => inv.created_at },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {confirmDialog}
      <PageHeader
        description={t("list.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
              {t("list.refresh")}
            </Button>
            {canCreateInvites ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> {t("list.send")}
              </Button>
            ) : null}
          </>
        }
      />

      {!canWriteUsers ? <ReadOnlyNotice /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.title")}</CardTitle>
          <CardDescription>
            {t("list.count", { shown: rows.length, total: items.length, count: items.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ListToolbar
            search={lv.search}
            onSearchChange={lv.setSearch}
            searchPlaceholder={t("list.searchPlaceholder")}
            filters={[
              {
                id: "status",
                label: t("list.filters.status.label"),
                value: lv.filters.status ?? "",
                options: [
                  { label: t("list.filters.status.pending"), value: "pending" },
                  {
                    label: t("list.filters.status.accepted"),
                    value: "accepted",
                  },
                  { label: t("list.filters.status.expired"), value: "expired" },
                  { label: t("list.filters.status.revoked"), value: "revoked" },
                ],
                onChange: (v) => lv.setFilter("status", v),
              },
            ]}
            columns={[
              ...(canReadRoles ? [{ id: "role", label: t("list.columns.role") }] : []),
              { id: "expires", label: t("list.columns.expires") },
              { id: "sent", label: t("list.columns.sent") },
            ]}
            isColumnVisible={lv.isVisible}
            onToggleColumn={lv.toggleColumn}
            density={lv.density}
            onDensityChange={lv.setDensity}
            onExport={(fmt) =>
              fmt === "csv"
                ? exportToCsv("invitations", rows, inviteCsvColumns)
                : exportToJson("invitations", rows)
            }
            exportDisabled={rows.length === 0}
            hasActiveFilters={lv.hasActiveFilters}
            onClear={lv.clear}
          />
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={rows.length === 0}
            emptyIcon={MailIcon}
            emptyTitle={lv.hasActiveFilters ? t("list.emptyFiltered") : t("list.empty")}
            skeletonRows={3}
          >
            <Table className={denseCls}>
              <TableHeader>
                <TableRow>
                  <SortHeader columnKey="email" sort={lv.sort} onToggle={lv.toggleSort}>
                    {t("list.columns.email")}
                  </SortHeader>
                  {canReadRoles && lv.isVisible("role") ? (
                    <TableHead>{t("list.columns.role")}</TableHead>
                  ) : null}
                  <TableHead>{t("list.columns.status")}</TableHead>
                  {lv.isVisible("expires") && (
                    <SortHeader columnKey="expires" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("list.columns.expires")}
                    </SortHeader>
                  )}
                  {lv.isVisible("sent") && (
                    <SortHeader columnKey="sent" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("list.columns.sent")}
                    </SortHeader>
                  )}
                  {canWriteUsers ? (
                    <TableHead className="text-right">{t("list.columns.actions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    {canReadRoles && lv.isVisible("role") ? (
                      <TableCell>
                        <Badge variant="muted">{roleName(inv.role_id)}</Badge>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <StatusPill status={inv.status} />
                    </TableCell>
                    {lv.isVisible("expires") && (
                      <TableCell>
                        <TimeSince value={inv.expires_at} />
                      </TableCell>
                    )}
                    {lv.isVisible("sent") && (
                      <TableCell>
                        <TimeSince value={inv.created_at} />
                      </TableCell>
                    )}
                    {canWriteUsers ? (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              (inv.status !== "pending" && inv.status !== "expired") ||
                              resendM.isPending
                            }
                            onClick={() => resendM.mutate(inv.id)}
                          >
                            {resendM.isPending && resendM.variables === inv.id ? (
                              <LoaderCircleIcon className="animate-spin" />
                            ) : (
                              <SendIcon />
                            )}
                            {t("table.resend")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={inv.status !== "pending" || revokeM.isPending}
                            onClick={() =>
                              openConfirm({
                                title: t("confirm.revokeTitle", {
                                  email: inv.email,
                                }),
                                variant: "destructive",
                                confirmLabel: t("confirm.revokeLabel"),
                                onConfirm: () => revokeM.mutate(inv.id),
                              })
                            }
                          >
                            <TrashIcon /> {t("table.revoke")}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      {canCreateInvites ? (
        <InviteSheet open={creating} onOpenChange={setCreating} currentTenantId={tenantId} />
      ) : null}
    </div>
  );
}
