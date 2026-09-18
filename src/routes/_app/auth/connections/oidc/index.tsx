import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppWindowIcon, Loader2Icon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { ApplicationHelpLinks } from "@/modules/authentication/components/application-help-links";
import { ApplicationStats } from "@/modules/authentication/components/application-stats";
import { OidcQuickstart } from "@/modules/authentication/components/oidc-quickstart";
import { RegisterApplicationSheet } from "@/modules/authentication/components/register-application-sheet";
import {
  type OidcClient,
  useDeleteOidcClient,
  useOidcClients,
} from "@/modules/authentication/api/oidc-clients";
import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  BulkBar,
  ListToolbar,
  MasterCheckbox,
  RowCheckbox,
  SortHeader,
} from "@/shared/components/data-table";
import { parseCreateIntent, useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

export const Route = createFileRoute("/_app/auth/connections/oidc/")({
  // `?action=create` deep-links from the Applications hub straight into the drawer.
  validateSearch: parseCreateIntent,
  component: OidcPage,
});

const csvColumns: CsvColumn<OidcClient>[] = [
  { header: "Name", value: (c) => c.name },
  { header: "Client ID", value: (c) => c.client_id },
  { header: "Type", value: (c) => c.type },
  { header: "Redirect URIs", value: (c) => c.redirect_uris.join(" ") },
  { header: "Scopes", value: (c) => c.scopes.join(" ") },
  { header: "Created", value: (c) => c.created_at },
];

function OidcPage() {
  const { t } = useTranslation("oidc");
  const { can } = useCapabilities();
  const canWrite = can("connection.write");

  const listQ = useOidcClients();
  const deleteM = useDeleteOidcClient();

  const [creating, setCreating] = useCreateIntent(true);
  const [confirmingDelete, setConfirmingDelete] = useState<OidcClient | null>(null);
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<{
    client: OidcClient;
    secret: string;
  } | null>(null);

  const items = listQ.data?.items ?? [];

  // The backend returns the list created_at DESC, so the default view is
  // already newest-first; SortHeader lets an operator override that.
  const lv = useListView(items, {
    searchFields: (c) => [c.name, c.client_id, ...c.scopes, ...c.redirect_uris],
    filterFields: { type: (c) => c.type },
    sortFields: { name: (c) => c.name, created: (c) => c.created_at },
    initialHidden: ["redirectUris"],
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const selectableIds = rows.map((c) => c.id);
  const selected = rows.filter((c) => selectedIds.has(c.id));
  const bulkBusy = bulkProgress !== null;

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Sequential fan-out: the delete endpoint is per-id and each one writes an
  // audit row, so keep them ordered rather than flooding the backend.
  async function deleteSelected() {
    const targets = [...selected];
    setBulkProgress({ done: 0, total: targets.length });
    for (const [i, client] of targets.entries()) {
      try {
        await deleteM.mutateAsync(client.id);
      } catch {
        // The global mutation cache already surfaced a toast; keep going so one
        // failure doesn't strand the rest of the selection.
      }
      setBulkProgress({ done: i + 1, total: targets.length });
    }
    setBulkProgress(null);
    setSelectedIds(new Set());
    setConfirmingBulk(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
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
              {t("common:actions.refresh")}
            </Button>
            {canWrite && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> {t("list.register")}
              </Button>
            )}
          </>
        }
      />

      {revealed && (
        <div className="flex flex-col gap-2">
          <OidcQuickstart client={revealed.client} secret={revealed.secret || undefined} />
          <div>
            <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
              {t("common:actions.dismiss")}
            </Button>
          </div>
        </div>
      )}

      <ApplicationStats clients={items} isLoading={listQ.isLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.registeredTitle")}</CardTitle>
          <CardDescription>
            {lv.hasActiveFilters
              ? t("list.shownOf", { shown: rows.length, total: items.length })
              : t("list.appCount", { count: items.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ListToolbar
            search={lv.search}
            onSearchChange={lv.setSearch}
            searchPlaceholder={t("list.searchPlaceholder")}
            filters={[
              {
                id: "type",
                label: t("filters.type"),
                value: lv.filters.type ?? "",
                options: [
                  { label: t("filters.typePublic"), value: "public" },
                  { label: t("filters.typeConfidential"), value: "confidential" },
                ],
                onChange: (v) => lv.setFilter("type", v),
              },
            ]}
            columns={[
              { id: "clientId", label: t("table.clientId") },
              { id: "redirectUris", label: t("table.redirectUris") },
              { id: "scopes", label: t("table.scopes") },
              { id: "created", label: t("table.created") },
            ]}
            isColumnVisible={lv.isVisible}
            onToggleColumn={lv.toggleColumn}
            density={lv.density}
            onDensityChange={lv.setDensity}
            onExport={(fmt) =>
              fmt === "csv"
                ? exportToCsv("applications", rows, csvColumns)
                : exportToJson("applications", rows)
            }
            exportDisabled={rows.length === 0}
            hasActiveFilters={lv.hasActiveFilters}
            onClear={lv.clear}
          >
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("list.resultCount", { count: rows.length })}
            </span>
          </ListToolbar>

          {canWrite && selected.length > 0 && (
            <BulkBar
              count={selected.length}
              progress={bulkProgress}
              disabled={bulkBusy}
              onClear={() => setSelectedIds(new Set())}
            >
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkBusy}
                onClick={() => setConfirmingBulk(true)}
              >
                <Trash2Icon /> {t("bulk.delete")}
              </Button>
            </BulkBar>
          )}

          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            // AGENTS.md rule 5: DataState's default slot would render the raw
            // backend error.message, so map the code to curated copy instead.
            errorFallback={listQ.error ? errorMessage(listQ.error) : null}
            isEmpty={rows.length === 0}
            skeletonRows={3}
            empty={
              lv.hasActiveFilters ? (
                <EmptyState
                  icon={AppWindowIcon}
                  title={t("list.emptyTitleFiltered")}
                  description={t("list.emptyDescriptionFiltered")}
                  action={
                    <Button variant="outline" onClick={lv.clear}>
                      {t("list.clearFilters")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={AppWindowIcon}
                  title={t("list.emptyTitle")}
                  description={t("list.emptyDescription")}
                  action={
                    canWrite ? (
                      <Button onClick={() => setCreating(true)}>
                        <PlusIcon /> {t("list.registerFirst")}
                      </Button>
                    ) : undefined
                  }
                />
              )
            }
          >
            <Table className={denseCls}>
              <TableHeader>
                <TableRow>
                  {canWrite && (
                    <TableHead className="w-8">
                      <MasterCheckbox
                        selectableIds={selectableIds}
                        selectedIds={selectedIds}
                        onChange={setSelectedIds}
                        label={t("table.selectAll")}
                      />
                    </TableHead>
                  )}
                  <SortHeader columnKey="name" sort={lv.sort} onToggle={lv.toggleSort}>
                    {t("table.name")}
                  </SortHeader>
                  <TableHead>{t("table.type")}</TableHead>
                  {lv.isVisible("clientId") && <TableHead>{t("table.clientId")}</TableHead>}
                  {lv.isVisible("redirectUris") && <TableHead>{t("table.redirectUris")}</TableHead>}
                  {lv.isVisible("scopes") && <TableHead>{t("table.scopes")}</TableHead>}
                  {lv.isVisible("created") && (
                    <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                      {t("table.created")}
                    </SortHeader>
                  )}
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    {canWrite && (
                      <TableCell>
                        <RowCheckbox
                          id={c.id}
                          checked={selectedIds.has(c.id)}
                          disabled={bulkBusy}
                          label={t("table.selectRow", { name: c.name })}
                          onChange={toggleRow}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <Link
                        to="/auth/connections/oidc/$clientId"
                        params={{ clientId: c.client_id }}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.type === "confidential" ? "default" : "muted"}>
                        {c.type}
                      </Badge>
                    </TableCell>
                    {lv.isVisible("clientId") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.client_id.slice(0, 16)}…
                      </TableCell>
                    )}
                    {lv.isVisible("redirectUris") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {c.redirect_uris.slice(0, 2).join(", ")}
                        {c.redirect_uris.length > 2 && ` +${c.redirect_uris.length - 2}`}
                      </TableCell>
                    )}
                    {lv.isVisible("scopes") && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.scopes.slice(0, 3).map((s) => (
                            <Badge key={s} variant="muted">
                              {s}
                            </Badge>
                          ))}
                          {c.scopes.length > 3 && (
                            <Badge variant="muted">+{c.scopes.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {lv.isVisible("created") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <TimeSince value={c.created_at} />
                      </TableCell>
                    )}
                    <TableCell className="text-right whitespace-nowrap">
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmingDelete(c)}
                          disabled={deleteM.isPending || bulkBusy}
                        >
                          <Trash2Icon /> {t("common:actions.delete")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>

          <ApplicationHelpLinks />
        </CardContent>
      </Card>

      <RegisterApplicationSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(client, secret) => setRevealed({ client, secret })}
      />

      <AlertDialog
        open={!!confirmingDelete}
        onOpenChange={(o) => {
          if (!o && !deleteM.isPending) setConfirmingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingDelete ? (
                <Trans
                  t={t}
                  i18nKey="delete.descriptionNamed"
                  values={{ name: confirmingDelete.name }}
                  components={{
                    strong: <span className="font-medium text-foreground" />,
                  }}
                />
              ) : (
                t("delete.descriptionFallback")
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteM.isPending}>
              {t("common:actions.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteM.isPending}
              onClick={() =>
                confirmingDelete &&
                deleteM.mutate(confirmingDelete.id, {
                  onSuccess: () => setConfirmingDelete(null),
                })
              }
            >
              {deleteM.isPending && <Loader2Icon className="animate-spin" />}
              {deleteM.isPending ? t("common:actions.deleting") : t("common:actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmingBulk}
        onOpenChange={(o) => {
          if (!o && !bulkBusy) setConfirmingBulk(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.titleBulk", { count: selected.length })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.descriptionBulk", { count: selected.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>{t("common:actions.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={bulkBusy} onClick={deleteSelected}>
              {bulkBusy && <Loader2Icon className="animate-spin" />}
              {bulkBusy ? t("common:actions.deleting") : t("common:actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
