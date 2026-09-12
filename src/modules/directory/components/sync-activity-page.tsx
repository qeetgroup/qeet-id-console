import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import {
  BellPlusIcon,
  CircleCheckIcon,
  CircleXIcon,
  Clock3Icon,
  DownloadIcon,
  EllipsisIcon,
  NetworkIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useTenantId } from "@/platform/auth/session";
import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import {
  DEFAULT_EVENT_FILTERS,
  type DirectoryEvent,
  type DirectoryEventPage,
  type EventFilters,
  fetchDirectoryExport,
  useCreateDirectoryAlert,
  useDirectoryConnections,
  useDirectoryEvents,
} from "../api/directory";
import type { DirectoryConnection } from "../directory-model";
import {
  DIRECTORY_ACTION,
  DIRECTORY_PAGE,
  DIRECTORY_PANEL,
  DirectoryPanel,
  DirectoryPagination,
  DirectoryQueryError,
  DirectorySearch,
  DirectorySelect,
  DirectoryStat,
  DirectoryStatus,
  formatDirectoryDuration,
} from "./directory-ui";

export function SyncActivityPage() {
  const tenantId = useTenantId();
  const access = useCapabilities();
  const [filters, setFilters] = useState(DEFAULT_EVENT_FILTERS);
  const deferredSearch = useDeferredValue(filters.q);
  const events = useDirectoryEvents({ ...filters, q: deferredSearch });
  const connections = useDirectoryConnections();
  const [alertOpen, setAlertOpen] = useState(false);
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const rows = await fetchDirectoryExport(tenantId, filters);
      exportToCsv("directory-sync-activity", rows, [
        { header: "id", value: (row) => row.id },
        { header: "connection_id", value: (row) => row.connection_id },
        { header: "operation", value: (row) => row.operation },
        { header: "started_at", value: (row) => row.started_at },
        { header: "duration_ms", value: (row) => row.duration_ms },
        { header: "users_synced", value: (row) => row.users_synced },
        { header: "groups_synced", value: (row) => row.groups_synced },
        { header: "status", value: (row) => row.status },
      ]);
    },
  });
  return (
    <>
      <SyncActivityView
        page={events.isError ? undefined : events.data}
        connections={connections.data ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        loading={events.isPending}
        error={events.isError}
        busy={events.isFetching}
        retry={events.refetch}
        canWrite={access.can("connection.write")}
        onCreateAlert={() => setAlertOpen(true)}
        onExport={() => exportMutation.mutate()}
        exporting={exportMutation.isPending}
        exportError={exportMutation.isError ? errorMessage(exportMutation.error) : undefined}
      />
      {alertOpen ? (
        <DirectoryAlertDialog
          connections={connections.data ?? []}
          onClose={() => setAlertOpen(false)}
        />
      ) : null}
    </>
  );
}

export function SyncActivityView({
  page,
  connections,
  filters,
  onFiltersChange,
  loading,
  error,
  busy,
  retry,
  canWrite,
  onCreateAlert,
  onExport,
  exporting,
  exportError,
}: {
  page?: DirectoryEventPage;
  connections: DirectoryConnection[];
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  loading: boolean;
  error: boolean;
  busy: boolean;
  retry: () => unknown;
  canWrite: boolean;
  onCreateAlert: () => void;
  onExport: () => void;
  exporting: boolean;
  exportError?: string;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const [selected, setSelected] = useState<DirectoryEvent | null>(null);
  const [series, setSeries] = useState<"users" | "groups">("users");
  const summary = page?.summary;
  const latest = page?.items[0];
  const nameFor = (id: string) =>
    connections.find((connection) => connection.id === id)?.name ??
    t("directory.activity.removedConnection");
  const change = (next: Partial<EventFilters>) =>
    onFiltersChange({ ...filters, ...next, offset: 0 });
  const rate = (value: number | undefined) =>
    !summary?.total || value == null
      ? t("directory.activity.noRuns")
      : t("directory.activity.rate", { percent: Math.round((value / summary.total) * 100) });

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.activity.title")}
        description={t("directory.activity.description")}
        actions={
          <>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              onClick={onExport}
              disabled={exporting || !page?.total}
            >
              <DownloadIcon /> {t("directory.activity.export")}
            </Button>
            {canWrite ? (
              <Button className={DIRECTORY_ACTION} onClick={onCreateAlert}>
                <BellPlusIcon /> {t("directory.activity.createAlert")}
              </Button>
            ) : null}
          </>
        }
      />
      {error ? <DirectoryQueryError retry={retry} busy={busy} /> : null}
      {exportError ? (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      ) : null}
      <search
        aria-label={t("directory.activity.filters")}
        className={cn(DIRECTORY_PANEL, "flex flex-wrap gap-2 p-3")}
      >
        <DirectorySelect
          label={t("directory.dateRange")}
          value={String(filters.days)}
          onChange={(value) => change({ days: Number(value) })}
          options={[7, 30, 90].map((days) => ({
            value: String(days),
            label: t("directory.lastDays", { days }),
          }))}
        />
        <DirectorySelect
          label={t("directory.connectionsPage.table")}
          value={filters.connection_id}
          onChange={(connection_id) => change({ connection_id })}
          options={[
            { value: "all", label: t("directory.allConnections") },
            ...connections.map((connection) => ({ value: connection.id, label: connection.name })),
          ]}
        />
        <DirectorySelect
          label={t("directory.activity.result")}
          value={filters.status}
          onChange={(status) => change({ status })}
          options={[
            { value: "all", label: t("directory.allStatuses") },
            ...["success", "warning", "failed"].map((status) => ({
              value: status,
              label: t(`directory.activity.${status}`),
            })),
          ]}
        />
        <DirectorySearch
          label={t("directory.activity.search")}
          value={filters.q}
          onChange={(q) => change({ q })}
        />
      </search>
      <section
        aria-label={t("directory.activity.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-5"
      >
        <DirectoryStat
          label={t("directory.activity.total")}
          value={summary?.total}
          icon={RefreshCwIcon}
          loading={loading}
          detail={t("directory.lastDays", { days: filters.days })}
        />
        <DirectoryStat
          label={t("directory.activity.successful")}
          value={summary?.successful}
          icon={CircleCheckIcon}
          loading={loading}
          tone="success"
          detail={rate(summary?.successful)}
        />
        <DirectoryStat
          label={t("directory.activity.warnings")}
          value={summary?.warnings}
          icon={TriangleAlertIcon}
          loading={loading}
          tone="warning"
          detail={rate(summary?.warnings)}
        />
        <DirectoryStat
          label={t("directory.activity.failedRuns")}
          value={summary?.failed}
          icon={CircleXIcon}
          loading={loading}
          tone="danger"
          detail={rate(summary?.failed)}
        />
        <DirectoryStat
          label={t("directory.activity.average")}
          value={formatDirectoryDuration(summary?.average_duration_ms)}
          icon={Clock3Icon}
          loading={loading}
          tone="info"
          detail={t("directory.activity.recordedDuration")}
        />
      </section>

      <section className={DIRECTORY_PANEL} aria-label={t("directory.activity.title")}>
        <header className="px-4 py-3">
          <h2 className="font-heading text-sm font-semibold">
            {t("directory.activity.title")}{" "}
            <span className="font-normal text-muted-foreground">({page?.total ?? 0})</span>
          </h2>
        </header>
        <div className="overflow-x-auto">
          <Table className="min-w-220 text-xs [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:text-[10px]">
            <TableHeader className="border-y border-border/60 bg-muted/25">
              <TableRow>
                {[
                  "connection",
                  "trigger",
                  "started",
                  "duration",
                  "users",
                  "groups",
                  "result",
                  "actions",
                ].map((column) => (
                  <TableHead key={column}>{t(`directory.activity.${column}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? [0, 1, 2].map((index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : page?.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <NetworkIcon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium">{nameFor(event.connection_id)}</span>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {t(`directory.activity.operation.${event.operation}`, {
                                defaultValue: event.operation,
                              })}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {t(`directory.activity.triggerTypes.${event.trigger}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(event.started_at).toLocaleString(i18n.resolvedLanguage)}
                      </TableCell>
                      <TableCell>{formatDirectoryDuration(event.duration_ms)}</TableCell>
                      <TableCell className="tabular-nums">
                        {event.users_synced.toLocaleString(i18n.resolvedLanguage)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {event.groups_synced.toLocaleString(i18n.resolvedLanguage)}
                      </TableCell>
                      <TableCell>
                        <DirectoryStatus
                          label={t(`directory.activity.${event.status}`)}
                          tone={
                            event.status === "success"
                              ? "success"
                              : event.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t("directory.activity.details", {
                            name: nameFor(event.connection_id),
                          })}
                          onClick={() => setSelected(event)}
                        >
                          <EllipsisIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && !page?.items.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {t(error ? "directory.loadError" : "directory.activity.empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <DirectoryPagination
          total={page?.total ?? 0}
          limit={filters.limit}
          offset={filters.offset}
          busy={busy}
          onChange={(offset) => onFiltersChange({ ...filters, offset })}
        />
      </section>

      <div className="grid gap-3 @min-[800px]/directory-page:grid-cols-[1.5fr_1fr]">
        <DirectoryPanel
          title={t("directory.activity.volumeTitle")}
          description={t("directory.activity.volumeDescription")}
          action={
            <fieldset className="flex shrink-0 rounded-md border border-border bg-muted/30 p-0.5">
              <legend className="sr-only">{t("directory.activity.series")}</legend>
              {(["users", "groups"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={series === value}
                  className={cn(
                    "rounded-sm px-3 py-1 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    series === value && "bg-primary/10 text-primary",
                  )}
                  onClick={() => setSeries(value)}
                >
                  {t(`directory.activity.${value}`)}
                </button>
              ))}
            </fieldset>
          }
        >
          {page?.volume.length ? (
            <div
              className="h-48 w-full"
              role="img"
              aria-label={t("directory.activity.volumeTitle")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={page.volume}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value: string) => value.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                  <Bar
                    dataKey={series}
                    fill={series === "users" ? "var(--color-blue-400)" : "var(--color-violet-400)"}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-48 place-items-center text-xs text-muted-foreground">
              {t("directory.activity.emptyVolume")}
            </div>
          )}
        </DirectoryPanel>
        <DirectoryPanel title={t("directory.activity.latestTitle")}>
          {latest ? (
            <EventDetails event={latest} name={nameFor(latest.connection_id)} />
          ) : (
            <div className="grid h-48 place-items-center text-xs text-muted-foreground">
              {t("directory.activity.noRuns")}
            </div>
          )}
        </DirectoryPanel>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("directory.activity.detailTitle")}</SheetTitle>
            <SheetDescription>{selected ? nameFor(selected.connection_id) : ""}</SheetDescription>
          </SheetHeader>
          <div className="p-5">
            {selected ? (
              <EventDetails event={selected} name={nameFor(selected.connection_id)} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EventDetails({ event, name }: { event: DirectoryEvent; name: string }) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <strong>{name}</strong>
        <TimeSince
          value={event.started_at}
          className="shrink-0 text-[10px] text-muted-foreground"
        />
      </div>
      <dl className="divide-y divide-border/50">
        {[
          [t("directory.activity.duration"), formatDirectoryDuration(event.duration_ms)],
          [t("directory.activity.users"), event.users_synced],
          [t("directory.activity.groups"), event.groups_synced],
          [t("directory.activity.trigger"), t(`directory.activity.triggerTypes.${event.trigger}`)],
          [t("directory.activity.result"), t(`directory.activity.${event.status}`)],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className={cn(
          "mt-3 rounded-md p-3",
          event.status === "success"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
        )}
      >
        <p className="font-medium">{t(`directory.activity.${event.status}`)}</p>
        <p className="mt-1 text-[11px]">{event.message}</p>
      </div>
    </div>
  );
}

function DirectoryAlertDialog({
  connections,
  onClose,
}: {
  connections: DirectoryConnection[];
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [name, setName] = useState("");
  const [connection, setConnection] = useState("");
  const [threshold, setThreshold] = useState(1);
  const mutation = useCreateDirectoryAlert();
  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("directory.activity.createAlert")}</DialogTitle>
          <DialogDescription>{t("directory.activity.alertDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || mutation.isPending) return;
            mutation.mutate(
              { name: name.trim(), connection_id: connection || null, threshold },
              { onSuccess: onClose },
            );
          }}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="directory-alert-name">
                {t("directory.activity.alertName")}
              </FieldLabel>
              <Input
                id="directory-alert-name"
                value={name}
                maxLength={100}
                required
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <DirectorySelect
              label={t("directory.activity.connection")}
              value={connection}
              onChange={setConnection}
              options={[
                { value: "all", label: t("directory.allConnections") },
                ...connections.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <Field>
              <FieldLabel htmlFor="directory-alert-threshold">
                {t("directory.activity.threshold")}
              </FieldLabel>
              <Input
                id="directory-alert-threshold"
                type="number"
                min={1}
                max={100}
                required
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
            </Field>
            {mutation.isError ? <FieldError>{errorMessage(mutation.error)}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim() || mutation.isPending}>
                {t("directory.activity.createAlert")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
