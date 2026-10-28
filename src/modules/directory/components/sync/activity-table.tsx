import { ArrowRightIcon, PanelRightOpenIcon } from "@qeetrix/icons";
import { Badge, formatNumber, MenuItem, Select, type TableColumn } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import {
  type DirectoryConnection,
  formatDirectoryDuration,
} from "@/modules/directory/directory-model";
import { runKey } from "@/modules/directory/sync-model";
import { type ActivityFilters, type Period, RESULTS } from "@/modules/directory/sync-search";
import { RESULT_TONE } from "./activity-band";
import {
  ANY,
  ConnectionSelect,
  PeriodSelect,
  useChanged,
  useConnectionNames,
  When,
} from "./sync-parts";

/**
 * The list's columns, one fact each: when it started, the run (what, then its connection and who
 * started it), what it changed, how long it took, and how it ended with the failure's code.
 */
export function useActivityColumns({
  connections,
  now,
}: {
  connections: readonly DirectoryConnection[];
  now: number;
}): TableColumn<DirectoryEvent>[] {
  const { t } = useTranslation("directory");
  const nameOf = useConnectionNames(connections);
  const changed = useChanged();
  return [
    {
      id: "started",
      header: t("activity.columns.started"),
      width: 130,
      cell: (e) => <When at={e.started_at} now={now} />,
    },
    {
      id: "run",
      header: t("activity.columns.run"),
      primary: true,
      cell: (e) => (
        <span className="sync-two">
          <span className="sync-main">{t(runKey(e))}</span>
          <small>
            {nameOf(e.connection_id)} · {t(`sync.triggers.${e.trigger}`)}
          </small>
        </span>
      ),
    },
    {
      id: "changed",
      header: t("activity.columns.changed"),
      width: 150,
      cell: (e) =>
        e.status === "success" && (e.users_synced || e.groups_synced) ? (
          changed(e)
        ) : (
          <span className="sync-subtle">{changed(e)}</span>
        ),
    },
    {
      id: "took",
      header: t("activity.columns.took"),
      numeric: true,
      width: 90,
      cell: (e) => formatDirectoryDuration(e.duration_ms),
    },
    {
      id: "result",
      header: t("activity.columns.result"),
      width: 170,
      cell: (e) => (
        <span className="sync-result">
          <Badge tone={RESULT_TONE[e.status]} size="sm">
            {t(`sync.results.${e.status}`)}
          </Badge>
          {e.error_code ? <code>{e.error_code}</code> : null}
        </span>
      ),
    },
  ];
}

/** A run's menu: its details, and for a failure, its place on Sync errors. */
export function ActivityRowMenu({
  event,
  onView,
  onOpenErrors,
}: {
  event: DirectoryEvent;
  onView: (event: DirectoryEvent) => void;
  onOpenErrors: (event: DirectoryEvent) => void;
}) {
  const { t } = useTranslation("directory");
  return (
    <>
      <MenuItem icon={PanelRightOpenIcon} onClick={() => onView(event)}>
        {t("activity.actions.view")}
      </MenuItem>
      {event.status !== "success" ? (
        <MenuItem icon={ArrowRightIcon} onClick={() => onOpenErrors(event)}>
          {t("activity.actions.openErrors")}
        </MenuItem>
      ) : null}
    </>
  );
}

/**
 * One row above the table: search (the server's: an operation, a message or a code), the period,
 * the connection and the result. Under it, what's applied, as tags, with how many runs that leaves.
 */
export function ActivityToolbar({
  filters,
  onFiltersChange,
  connections,
  shown,
  total,
}: {
  filters: ActivityFilters;
  onFiltersChange: (next: ActivityFilters) => void;
  connections: readonly DirectoryConnection[];
  /** Runs on these filters, and in the period: the tags' summary. */
  shown: number;
  total: number;
}) {
  const { t } = useTranslation("directory");
  const searchRef = useRef<HTMLInputElement>(null);
  const nameOf = useConnectionNames(connections);
  const n = (value: number) => formatNumber(value, formatLocale());
  // The field's text, which follows the address when a link elsewhere on the page changes it.
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<ActivityFilters>) => onFiltersChange({ ...filters, ...patch });

  const tags: AppliedFilter[] = [];
  if (filters.connection)
    tags.push({
      id: "connection",
      label: t("sync.connection"),
      value: nameOf(filters.connection),
    });
  if (filters.result)
    tags.push({
      id: "result",
      label: t("activity.filters.result"),
      value: t(`sync.results.${filters.result}`),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("activity.filters.search")}
          placeholder={t("activity.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <PeriodSelect
          value={filters.period ?? "30d"}
          onChange={(period: Period) => set({ period: period === "30d" ? undefined : period })}
        />
        <ConnectionSelect
          value={filters.connection}
          connections={connections}
          onChange={(connection) => set({ connection })}
        />
        <Select
          aria-label={t("activity.filters.result")}
          className="ppl-filter"
          value={filters.result ?? ANY}
          onValueChange={(value) => set({ result: RESULTS.find((r) => r === value) ?? undefined })}
          items={[
            { value: ANY, label: t("activity.filters.anyResult") },
            ...RESULTS.map((r) => ({ value: r, label: t(`sync.results.${r}`) })),
          ]}
        />
      </div>
      {/* Only once something narrows the list: with nothing applied, the count is the header's.
          FilterTags shows its summary even with no tags (QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ period: filters.period, q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("activity.filters.summary", { n: n(shown), total: n(total) })}
        />
      ) : null}
    </div>
  );
}
