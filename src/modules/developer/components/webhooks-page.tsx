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
import { Link } from "@tanstack/react-router";
import {
  PlayIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  TrashIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import { FeatureGate, useEntitlements } from "@/modules/billing";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { useListView } from "@/shared/hooks/use-list-view";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type Webhook,
  useDisableWebhook,
  useEnableWebhook,
  useTestWebhook,
  useWebhooks,
} from "../api/webhooks";
import { webhookState } from "../webhook-state";
import { WebhookStatusPill } from "./webhook-status";
import { CreateWebhookSheet } from "./webhooks-page-create";

const webhookCsvColumns: CsvColumn<Webhook>[] = [
  { header: "id", value: (w) => w.id },
  { header: "url", value: (w) => w.url },
  { header: "events", value: (w) => w.events.join("; ") },
  { header: "status", value: (w) => webhookState(w) },
  { header: "failing_since", value: (w) => w.failing_since ?? "" },
  { header: "created_at", value: (w) => w.created_at },
];

// The list filters on whether an endpoint is on and healthy, on and failing, or off.
function statusFilterValue(w: Webhook): "active" | "failing" | "disabled" {
  const state = webhookState(w);
  return state === "autoDisabled" ? "disabled" : state;
}

/** Renders the tenant's webhooks with test and disable, and the sheet that creates one. */
export function WebhooksPage() {
  const { t } = useTranslation(["developer", "common"]);
  const runSensitive = useSensitiveAction();
  const webhooksLocked = useEntitlements().data?.features.webhooks === false;
  const [creating, setCreating] = useCreateIntent(
    useCapabilities().can("webhook.write") && !webhooksLocked,
  );
  const [revealed, setRevealed] = useState<{ url: string; secret: string } | null>(null);

  const listQ = useWebhooks();

  const items = listQ.data?.items ?? [];
  const lv = useListView(items, {
    searchFields: (w) => [w.url, ...w.events],
    filterFields: { status: statusFilterValue },
    sortFields: { url: (w) => w.url, created: (w) => w.created_at },
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const disableM = useDisableWebhook();
  const enableM = useEnableWebhook();
  const testM = useTestWebhook();

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("webhooks.description")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => listQ.refetch()}
              disabled={listQ.isFetching}
            >
              <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
              {t("webhooks.refresh")}
            </Button>
            {!webhooksLocked && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <PlusIcon /> {t("webhooks.new")}
              </Button>
            )}
          </>
        }
      />

      {revealed && (
        <OneTimeSecret
          title={t("webhooks.revealed.title", { url: revealed.url })}
          description={t("webhooks.revealed.description")}
          values={[{ value: revealed.secret }]}
          dismissLabel={t("common:actions.dismiss")}
          onDismiss={() => setRevealed(null)}
        />
      )}

      <FeatureGate
        feature="webhooks"
        title={t("webhooksPage.webhooksAreAPaidFeature")}
        description={t("webhooksPage.receiveSignedHttpCallbacks")}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("webhooks.list.title")}</CardTitle>
            <CardDescription>
              {t("webhooks.list.count", {
                shown: rows.length,
                total: items.length,
                count: items.length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ListToolbar
              search={lv.search}
              onSearchChange={lv.setSearch}
              searchPlaceholder={t("webhooks.list.searchPlaceholder")}
              filters={[
                {
                  id: "status",
                  label: t("webhooks.list.filters.status.label"),
                  value: lv.filters.status ?? "",
                  options: [
                    {
                      label: t("webhooks.list.filters.status.active"),
                      value: "active",
                    },
                    {
                      label: t("webhooks.list.filters.status.failing"),
                      value: "failing",
                    },
                    {
                      label: t("webhooks.list.filters.status.disabled"),
                      value: "disabled",
                    },
                  ],
                  onChange: (v) => lv.setFilter("status", v),
                },
              ]}
              columns={[
                { id: "events", label: t("webhooks.list.columns.events") },
                { id: "created", label: t("webhooks.list.columns.created") },
              ]}
              isColumnVisible={lv.isVisible}
              onToggleColumn={lv.toggleColumn}
              density={lv.density}
              onDensityChange={lv.setDensity}
              onExport={(fmt) =>
                fmt === "csv"
                  ? exportToCsv("webhooks", rows, webhookCsvColumns)
                  : exportToJson("webhooks", rows)
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
              emptyIcon={WebhookIcon}
              emptyTitle={
                lv.hasActiveFilters ? t("webhooks.list.emptyFiltered") : t("webhooks.list.empty")
              }
              skeletonRows={3}
            >
              {listQ.data && (
                <Table className={denseCls}>
                  <TableHeader>
                    <TableRow>
                      <SortHeader columnKey="url" sort={lv.sort} onToggle={lv.toggleSort}>
                        {t("webhooks.list.columns.url")}
                      </SortHeader>
                      {lv.isVisible("events") && (
                        <TableHead>{t("webhooks.list.columns.events")}</TableHead>
                      )}
                      <TableHead>{t("webhooks.list.columns.status")}</TableHead>
                      {lv.isVisible("created") && (
                        <SortHeader columnKey="created" sort={lv.sort} onToggle={lv.toggleSort}>
                          {t("webhooks.list.columns.created")}
                        </SortHeader>
                      )}
                      <TableHead className="text-right">
                        {t("webhooks.list.columns.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to="/developer/webhooks/$id"
                            params={{ id: w.id }}
                            className="hover:underline"
                          >
                            {w.url}
                          </Link>
                        </TableCell>
                        {lv.isVisible("events") && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {w.events.slice(0, 3).map((e) => (
                                <Badge key={e} variant="muted">
                                  {e}
                                </Badge>
                              ))}
                              {w.events.length > 3 && (
                                <Badge variant="muted">+{w.events.length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <WebhookStatusPill webhook={w} />
                        </TableCell>
                        {lv.isVisible("created") && (
                          <TableCell>
                            <TimeSince value={w.created_at} />
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => testM.mutate(w.id)}
                            disabled={!!w.disabled_at || testM.isPending}
                          >
                            <PlayIcon /> {t("webhooks.table.test")}
                          </Button>
                          {w.disabled_at ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                runSensitive({
                                  actionLabel: t("webhooks.stepUp.enable"),
                                  run: () => enableM.mutateAsync(w.id),
                                }).catch(settleSensitiveAction)
                              }
                              disabled={enableM.isPending}
                            >
                              <PowerIcon /> {t("webhooks.table.enable")}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                runSensitive({
                                  confirm: {
                                    title: t("webhooks.confirm.disableTitle"),
                                    description: t("webhooks.confirm.disableDescription", {
                                      url: w.url,
                                    }),
                                    confirmLabel: t("webhooks.confirm.disableLabel"),
                                    tone: "destructive",
                                  },
                                  actionLabel: t("webhooks.stepUp.disable"),
                                  run: () => disableM.mutateAsync(w.id),
                                }).catch(settleSensitiveAction)
                              }
                              disabled={disableM.isPending}
                            >
                              <TrashIcon /> {t("webhooks.table.disable")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </DataState>
          </CardContent>
        </Card>
      </FeatureGate>

      <CreateWebhookSheet
        open={creating}
        onOpenChange={setCreating}
        onCreated={(w) => w.secret && setRevealed({ url: w.url, secret: w.secret })}
      />
    </div>
  );
}
