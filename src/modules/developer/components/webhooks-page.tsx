import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusPill,
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
import { PlayIcon, PlusIcon, RefreshCwIcon, TrashIcon, WebhookIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListToolbar, SortHeader } from "@/shared/components/data-table";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import { useTenantId } from "@/platform/auth/session";
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
  useCreateWebhook,
  useDisableWebhook,
  useTestWebhook,
  useWebhooks,
} from "../api/webhooks";
import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

const KNOWN_EVENTS = [
  "user.created",
  "user.updated",
  "user.deleted",
  "tenant.created",
  "tenant.updated",
  "session.created",
  "session.revoked",
  "mfa.enrolled",
  "auth.failed",
];

const webhookCsvColumns: CsvColumn<Webhook>[] = [
  { header: "id", value: (w) => w.id },
  { header: "url", value: (w) => w.url },
  { header: "events", value: (w) => w.events.join("; ") },
  { header: "status", value: (w) => (w.disabled_at ? "disabled" : "active") },
  { header: "created_at", value: (w) => w.created_at },
];

/** Renders the tenant's webhooks with test and disable, and the sheet that creates one. */
export function WebhooksPage() {
  const { t } = useTranslation("developer");
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
    filterFields: { status: (w) => (w.disabled_at ? "disabled" : "active") },
    sortFields: { url: (w) => w.url, created: (w) => w.created_at },
  });
  const rows = lv.view;
  const denseCls = lv.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : undefined;

  const disableM = useDisableWebhook();
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
        title="Webhooks are a paid feature"
        description="Receive signed HTTP callbacks for events like user.created and session.revoked. Upgrade to Starter to create webhook subscriptions."
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
                          <StatusPill status={w.disabled_at ? "disabled" : "active"} />
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
                            disabled={!!w.disabled_at || disableM.isPending}
                          >
                            <TrashIcon /> {t("webhooks.table.disable")}
                          </Button>
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

/** Renders the sheet that subscribes an endpoint to events; the parent shows its secret once. */
function CreateWebhookSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (webhook: Webhook) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && (
          <CreateWebhookForm
            onCreated={(webhook) => {
              onCreated(webhook);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateWebhookForm({ onCreated }: { onCreated: (webhook: Webhook) => void }) {
  const { t } = useTranslation("developer");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateWebhook();
  const schema = useMemo(
    () =>
      z.object({
        url: z.url({ protocol: /^https?$/, error: t("webhooks.create.validation.url") }),
        events: z.array(z.string()).min(1, t("webhooks.create.validation.events")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { url: "", events: KNOWN_EVENTS.slice(0, 3) },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      await runSensitive({
        actionLabel: t("webhooks.stepUp.create"),
        run: () =>
          createM.mutateAsync({ tenant_id: tenantId, url: value.url.trim(), events: value.events }),
      })
        .then((webhook) => webhook && onCreated(webhook))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("webhooks.create.title")}</SheetTitle>
        <SheetDescription>{t("webhooks.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="url">
            {(field) => (
              <field.TextField
                label={t("webhooks.create.url")}
                description={t("webhooks.create.urlHelp")}
                type="url"
                placeholder={t("webhooks.create.urlPlaceholder")}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="events">
            {(field) => (
              <FieldFrame
                label={t("webhooks.create.events")}
                description={t("webhooks.create.eventsCount", { count: field.state.value.length })}
              >
                <EventChoices selected={field.state.value} />
              </FieldFrame>
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("webhooks.create.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("webhooks.create.submitting")}>
            {t("webhooks.create.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

// The event checkboxes, bound to the enclosing form field as one list.
function EventChoices({ selected }: { selected: string[] }) {
  const change = useFieldChange<string[]>();
  const toggle = (ev: string) =>
    change(selected.includes(ev) ? selected.filter((e) => e !== ev) : [...selected, ev]);
  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border p-3">
      {KNOWN_EVENTS.map((ev) => (
        <label key={ev} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(ev)} onChange={() => toggle(ev)} />
          <code className="text-xs">{ev}</code>
        </label>
      ))}
    </div>
  );
}
