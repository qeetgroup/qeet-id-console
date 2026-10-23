import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { Link } from "@tanstack/react-router";
import { AppWindowIcon, PlusIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApplicationHelpLinks } from "./application-help-links";
import { ApplicationStats } from "./application-stats";
import { OidcQuickstart } from "./oidc-quickstart";
import { ProofKeyBadge } from "./proof-key-status";
import { RegisterApplicationSheet } from "./register-application-sheet";
import { type OidcClient, useDeleteOidcClient, useOidcClients } from "../api/oidc-clients";
import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import {
  BulkBar,
  ListToolbar,
  MasterCheckbox,
  RowCheckbox,
  SortHeader,
} from "@/shared/components/data-table";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useListView } from "@/shared/hooks/use-list-view";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";

const csvColumns: CsvColumn<OidcClient>[] = [
  { header: "Name", value: (c) => c.name },
  { header: "Client ID", value: (c) => c.client_id },
  { header: "Type", value: (c) => c.type },
  { header: "Redirect URIs", value: (c) => c.redirect_uris.join(" ") },
  { header: "Scopes", value: (c) => c.scopes.join(" ") },
  { header: "Created", value: (c) => c.created_at },
];

/** Renders the organization's OAuth / OIDC applications, with bulk delete and export. */
export function OidcApplicationsPage() {
  const { t } = useTranslation("oidc");
  const { can } = useCapabilities();
  const canWrite = can("connection.write");
  const runSensitive = useSensitiveAction();

  const listQ = useOidcClients();
  const deleteM = useDeleteOidcClient();

  const [creating, setCreating] = useCreateIntent(true);
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

  const deleteOne = (client: OidcClient) =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("delete.title"),
        description: t("delete.confirmDescription", { name: client.name }),
        confirmLabel: t("common:actions.delete"),
        tone: "destructive",
      },
      actionLabel: t("delete.stepUp"),
      run: () => deleteM.mutateAsync(client.id),
    }).catch(settleSensitiveAction);

  // Sequential fan-out: the delete endpoint is per-id and each one writes an
  // audit row, so keep them ordered rather than flooding the backend.
  async function deleteSelected(targets: OidcClient[]) {
    setBulkProgress({ done: 0, total: targets.length });
    try {
      for (const [i, client] of targets.entries()) {
        try {
          await deleteM.mutateAsync(client.id);
        } catch (err) {
          // A refused step-up stops the run rather than asking again for every app. Any other
          // failure was already toasted by the mutation cache, so carry on with the rest.
          if (isStepUpRequired(err)) throw err;
        }
        setBulkProgress({ done: i + 1, total: targets.length });
      }
      setSelectedIds(new Set());
    } finally {
      setBulkProgress(null);
    }
  }

  const deleteBulk = () => {
    const targets = [...selected];
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("delete.titleBulk", { count: targets.length }),
        description: t("delete.descriptionBulk", { count: targets.length }),
        confirmLabel: t("common:actions.delete"),
        tone: "destructive",
      },
      actionLabel: t("delete.stepUpBulk"),
      run: () => deleteSelected(targets),
    }).catch(settleSensitiveAction);
  };

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

      {revealed &&
        (revealed.secret ? (
          <OneTimeSecret
            title={t("credentials.title", { name: revealed.client.name })}
            description={t("credentials.description")}
            values={[
              { label: "client_id=", value: revealed.client.client_id },
              { label: "client_secret=", value: revealed.secret },
            ]}
            dismissLabel={t("common:actions.dismiss")}
            onDismiss={() => setRevealed(null)}
          >
            <OidcQuickstart client={revealed.client} />
          </OneTimeSecret>
        ) : (
          // A public client has no secret, so only the quickstart is shown.
          <div className="flex flex-col gap-2">
            <OidcQuickstart client={revealed.client} />
            <div>
              <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
                {t("common:actions.dismiss")}
              </Button>
            </div>
          </div>
        ))}

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
              <Button variant="destructive" size="sm" disabled={bulkBusy} onClick={deleteBulk}>
                <TrashIcon /> {t("bulk.delete")}
              </Button>
            </BulkBar>
          )}

          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
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
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={c.type === "confidential" ? "default" : "muted"}>
                          {c.type}
                        </Badge>
                        <ProofKeyBadge client={c} />
                      </div>
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
                          onClick={() => deleteOne(c)}
                          disabled={deleteM.isPending || bulkBusy}
                        >
                          <TrashIcon /> {t("common:actions.delete")}
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
    </div>
  );
}
