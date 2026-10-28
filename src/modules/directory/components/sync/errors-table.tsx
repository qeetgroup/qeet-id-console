import { CheckIcon, PanelRightOpenIcon, RefreshCwIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatNumber,
  Link,
  MenuItem,
  Select,
  type TableColumn,
} from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { causeOf, runKey } from "@/modules/directory/sync-model";
import {
  type ErrorsFilters,
  type Period,
  RESOLUTIONS,
  SEVERITIES,
} from "@/modules/directory/sync-search";
import { ANY, ConnectionSelect, PeriodSelect, useConnectionNames, When } from "./sync-parts";

/** Who a failure reached, in words: a person (with their page), a new one, a group, no one. */
export function Affects({ event }: { event: DirectoryEvent }) {
  const { t } = useTranslation("directory");
  if (event.resource_type === "group") return <>{t("sync.about.group")}</>;
  if (event.resource_type === "connection")
    return <span className="sync-subtle">{t("sync.about.connection")}</span>;
  if (event.operation === "sign-in") return <>{t("sync.about.signIn")}</>;
  if (!event.resource_id) return <>{t("sync.about.newPerson")}</>;
  if (event.operation === "delete") return <>{t("sync.about.person")}</>;
  return (
    <Link render={<RouterLink to="/users/$userId" params={{ userId: event.resource_id }} />}>
      {t("sync.about.person")}
    </Link>
  );
}

export const SEVERITY_BADGE = {
  critical: { tone: "danger", variant: "solid" },
  warning: { tone: "warning", variant: "subtle" },
} as const;
export const RESOLUTION_TONE = {
  open: "neutral",
  resolved: "success",
  retried: "success",
} as const;

/**
 * The list's columns, one fact each: when it failed, the cause (then its connection and the run),
 * the server's code, who it reached, its severity and where it stands.
 */
export function useErrorColumns({
  connections,
  now,
}: {
  connections: readonly DirectoryConnection[];
  now: number;
}): TableColumn<DirectoryEvent>[] {
  const { t } = useTranslation("directory");
  const nameOf = useConnectionNames(connections);
  return [
    {
      id: "failed",
      header: t("errors.columns.failed"),
      width: 130,
      cell: (e) => <When at={e.started_at} now={now} />,
    },
    {
      id: "cause",
      header: t("errors.columns.cause"),
      primary: true,
      cell: (e) => (
        <span className="sync-two">
          <span className="sync-main">{t(`errors.causes.${causeOf(e)}.name`)}</span>
          <small>
            {nameOf(e.connection_id)} · {t(runKey(e))}
          </small>
        </span>
      ),
    },
    {
      id: "code",
      header: t("errors.columns.code"),
      width: 100,
      cell: (e) => <code className="sync-code">{e.error_code}</code>,
    },
    {
      id: "affects",
      header: t("errors.columns.affects"),
      width: 150,
      cell: (e) => <Affects event={e} />,
    },
    {
      id: "severity",
      header: t("errors.columns.severity"),
      width: 100,
      cell: (e) => {
        const severity = e.severity === "critical" ? "critical" : "warning";
        return (
          <Badge size="sm" {...SEVERITY_BADGE[severity]}>
            {t(`sync.severities.${severity}`)}
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: t("errors.columns.status"),
      width: 140,
      cell: (e) => (
        <Badge size="sm" tone={RESOLUTION_TONE[e.resolution]}>
          {t(`sync.resolutions.${e.resolution}`)}
        </Badge>
      ),
    },
  ];
}

/** A failure's menu: its details; for an open one, Check again (a connection check) and Mark resolved. */
export function ErrorRowMenu({
  event,
  canWrite,
  onView,
  onCheckAgain,
  onResolve,
}: {
  event: DirectoryEvent;
  canWrite: boolean;
  onView: (event: DirectoryEvent) => void;
  onCheckAgain: (events: readonly DirectoryEvent[]) => void;
  onResolve: (events: readonly DirectoryEvent[]) => void;
}) {
  const { t } = useTranslation("directory");
  const open = event.resolution === "open";
  return (
    <>
      <MenuItem icon={PanelRightOpenIcon} onClick={() => onView(event)}>
        {t("errors.actions.view")}
      </MenuItem>
      {canWrite && open && event.retryable ? (
        <MenuItem icon={RefreshCwIcon} onClick={() => onCheckAgain([event])}>
          {t("errors.problem.checkAgain")}
        </MenuItem>
      ) : null}
      {canWrite && open ? (
        <MenuItem icon={CheckIcon} onClick={() => onResolve([event])}>
          {t("errors.problem.markResolved")}
        </MenuItem>
      ) : null}
    </>
  );
}

/** The selection's actions: Check again for the connection checks in it, Mark resolved for the open ones. */
export function ErrorBulkActions({
  selected,
  pending,
  onCheckAgain,
  onResolve,
}: {
  selected: readonly DirectoryEvent[];
  pending: boolean;
  onCheckAgain: (events: readonly DirectoryEvent[]) => void;
  onResolve: (events: readonly DirectoryEvent[]) => void;
}) {
  const { t } = useTranslation("directory");
  const open = selected.filter((e) => e.resolution === "open");
  const retryable = open.filter((e) => e.retryable);
  return (
    <>
      {retryable.length ? (
        <Button
          size="sm"
          variant="soft"
          icon={RefreshCwIcon}
          loading={pending}
          onClick={() => onCheckAgain(retryable)}
        >
          {t("errors.problem.checkAgain")}
        </Button>
      ) : null}
      {open.length ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onResolve(open)}>
          {t("errors.problem.markResolved")}
        </Button>
      ) : null}
    </>
  );
}

/**
 * One row above the table: search (the server's: a code, a message or a person's ID), the period,
 * the connection, the status and the severity. Under it, what's applied, as tags.
 */
export function ErrorsToolbar({
  filters,
  onFiltersChange,
  connections,
  shown,
  total,
}: {
  filters: ErrorsFilters;
  onFiltersChange: (next: ErrorsFilters) => void;
  connections: readonly DirectoryConnection[];
  shown: number;
  total: number;
}) {
  const { t } = useTranslation("directory");
  const searchRef = useRef<HTMLInputElement>(null);
  const nameOf = useConnectionNames(connections);
  const n = (value: number) => formatNumber(value, formatLocale());
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<ErrorsFilters>) => onFiltersChange({ ...filters, ...patch });

  const tags: AppliedFilter[] = [];
  if (filters.connection)
    tags.push({ id: "connection", label: t("sync.connection"), value: nameOf(filters.connection) });
  if (filters.status)
    tags.push({
      id: "status",
      label: t("errors.filters.status"),
      value: t(`sync.resolutions.${filters.status}`),
    });
  if (filters.severity)
    tags.push({
      id: "severity",
      label: t("errors.filters.severity"),
      value: t(`sync.severities.${filters.severity}`),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("errors.filters.search")}
          placeholder={t("errors.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <PeriodSelect
          value={filters.period ?? "90d"}
          onChange={(period: Period) => set({ period: period === "90d" ? undefined : period })}
        />
        <ConnectionSelect
          value={filters.connection}
          connections={connections}
          onChange={(connection) => set({ connection })}
        />
        <Select
          aria-label={t("errors.filters.status")}
          className="ppl-filter"
          value={filters.status ?? ANY}
          onValueChange={(value) => set({ status: RESOLUTIONS.find((r) => r === value) })}
          items={[
            { value: ANY, label: t("errors.filters.anyStatus") },
            ...RESOLUTIONS.map((r) => ({ value: r, label: t(`sync.resolutions.${r}`) })),
          ]}
        />
        <Select
          aria-label={t("errors.filters.severity")}
          className="ppl-filter"
          value={filters.severity ?? ANY}
          onValueChange={(value) => set({ severity: SEVERITIES.find((s) => s === value) })}
          items={[
            { value: ANY, label: t("errors.filters.anySeverity") },
            ...SEVERITIES.map((s) => ({ value: s, label: t(`sync.severities.${s}`) })),
          ]}
        />
      </div>
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ period: filters.period, q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("errors.filters.summary", { n: n(shown), total: n(total) })}
        />
      ) : null}
    </div>
  );
}
