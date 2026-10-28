import { CircleCheckIcon, SearchIcon } from "@qeetrix/icons";
import {
  Button,
  formatNumber,
  MenuItem,
  MenuSeparator,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import {
  type AppliedFilter,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  type Anomaly,
  isAnomalyResolved,
  useAnomalies,
  useAnomalySummary,
} from "@/modules/security/api/anomalies";
import { useResolveAnomaly } from "@/modules/security/api/anomaly-actions";
import {
  ANOMALY_TYPES,
  type AnomalyFilters,
  anomalyFacts,
  isFiltered,
  matches,
  sourceAddress,
} from "@/modules/security/anomaly-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { AnomalySeverityBadge } from "../anomaly-badges";
import { BandPlaceholder } from "../band-placeholder";
import { When } from "../when";
import { AnomaliesBand } from "./anomalies-band";
import { AnomalyDrawer } from "./anomaly-drawer";
import { useAnomalyText } from "./anomaly-text";
import { useDenyAddress } from "./use-deny-address";
import "../security.css";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

export type AnomaliesPageProps = {
  filters: AnomalyFilters;
  onFiltersChange: (next: AnomalyFilters) => void;
};

/**
 * Security › Threats › Anomalies: each sign-in attack the lockout detected and slowed, newest
 * first. A row opens the anomaly in a drawer with its facts and what to do; resolving one marks
 * it dealt with, and nothing else.
 */
export function AnomaliesPage({ filters, onFiltersChange }: AnomaliesPageProps) {
  const { t } = useTranslation("security");
  const text = useAnomalyText();
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const list = useAnomalies();
  const summary = useAnomalySummary();
  const resolve = useResolveAnomaly();
  const runSensitive = useSensitiveAction();
  const denial = useDenyAddress();
  const [openId, setOpenId] = useState<string | null>(null);

  const items = list.data?.items ?? [];
  const now = list.dataUpdatedAt || Date.now();
  const rows = useMemo(() => items.filter((a) => matches(a, filters)), [items, filters]);
  const open = items.find((a) => a.id === openId) ?? null;
  const openCount = summary.data?.open ?? items.filter((a) => !isAnomalyResolved(a)).length;

  const onResolve = (a: Anomaly) =>
    runSensitive({
      capability: "policy.write",
      actionLabel: t("anomalies.resolve.action"),
      run: () => resolve.mutateAsync(a.id),
    }).catch(settleSensitiveAction);

  const columns: TableColumn<Anomaly>[] = [
    {
      id: "anomaly",
      header: t("anomalies.columns.anomaly"),
      primary: true,
      cell: (a) => (
        <span className="sec-two">
          <strong>{text.title(a)}</strong>
          <small>{text.line(a)}</small>
        </span>
      ),
    },
    {
      id: "severity",
      header: t("anomalies.columns.severity"),
      width: 104,
      cell: (a) => <AnomalySeverityBadge severity={a.severity} />,
    },
    {
      id: "target",
      header: t("anomalies.columns.target"),
      cell: (a) => {
        const f = anomalyFacts(a);
        if (a.user_email)
          return a.user_id ? (
            <Link className="sec-link" to="/users/$userId" params={{ userId: a.user_id }}>
              {a.user_email}
            </Link>
          ) : (
            a.user_email
          );
        if (f.accounts !== undefined)
          return t("anomalies.accounts", { count: f.accounts, n: formatNumber(f.accounts) });
        return <Text tone="subtle">—</Text>;
      },
    },
    {
      id: "source",
      header: t("anomalies.columns.source"),
      width: 168,
      cell: (a) => {
        const f = anomalyFacts(a);
        if (f.networks && f.networks > 1) return t("anomalies.networks", { count: f.networks });
        return f.network ? (
          <span className="sec-mono">{f.network}</span>
        ) : (
          <Text tone="subtle">—</Text>
        );
      },
    },
    {
      id: "detected",
      header: t("anomalies.columns.detected"),
      width: 136,
      cell: (a) => <When at={a.created_at} now={now} />,
    },
    {
      id: "status",
      header: t("anomalies.columns.status"),
      width: 168,
      cell: (a) =>
        isAnomalyResolved(a) ? (
          <span className="sec-quiet">
            {a.resolved_at ? (
              <>
                {t("anomalies.status.resolved")} <When at={a.resolved_at} now={now} />
              </>
            ) : (
              t("anomalies.status.resolved")
            )}
          </span>
        ) : (
          <span className="sec-open">{t("anomalies.status.open")}</span>
        ),
    },
  ];

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("anomalies.title")}
        count={list.data ? items.length : undefined}
        description={t("anomalies.description")}
        summary={
          list.data ? (
            <AnomaliesBand items={items} summary={summary.data} now={now} />
          ) : list.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={<PageTabList badges={{ "/security/threats/anomalies": openCount }} />}
      />
      <PageContent>
        <div className="ppl">
          {list.isError ? (
            <DataState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <Table<Anomaly>
              label={t("anomalies.title")}
              rows={rows}
              rowId={(a) => a.id}
              rowLabel={(a) => `${text.title(a)}, ${a.user_email ?? anomalyFacts(a).network ?? ""}`}
              columns={columns}
              loading={list.isLoading}
              onRowClick={(a) => setOpenId(a.id)}
              toolbar={
                <AnomaliesToolbar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  items={items}
                  shown={rows.length}
                />
              }
              rowActions={(a) => {
                const ip = sourceAddress(a);
                const denied = ip ? denial.deniedBy(ip) : undefined;
                return (
                  <>
                    <MenuItem onClick={() => setOpenId(a.id)}>
                      {t("anomalies.actions.open")}
                    </MenuItem>
                    {canWrite && !isAnomalyResolved(a) ? (
                      <MenuItem onClick={() => onResolve(a)}>
                        {t("anomalies.actions.resolve")}
                      </MenuItem>
                    ) : null}
                    {canWrite && ip && !denied ? (
                      <>
                        <MenuSeparator />
                        <MenuItem
                          tone="danger"
                          onClick={() =>
                            void denial.deny(ip, t("deny.label", { what: text.title(a) }))
                          }
                        >
                          {t("anomalies.actions.deny", { ip })}
                        </MenuItem>
                      </>
                    ) : null}
                    {a.user_id ? (
                      <MenuItem
                        render={<Link to="/users/$userId" params={{ userId: a.user_id }} />}
                      >
                        {t("anomalies.actions.account")}
                      </MenuItem>
                    ) : null}
                  </>
                );
              }}
              empty={
                isFiltered(filters) ? (
                  <EmptyState
                    size="section"
                    icon={SearchIcon}
                    title={t("anomalies.empty.filteredTitle")}
                    description={t("anomalies.empty.filteredDescription")}
                    actions={
                      <Button variant="ghost" onClick={() => onFiltersChange({})}>
                        {t("common.clearFilters")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    size="section"
                    icon={CircleCheckIcon}
                    title={t("anomalies.empty.title")}
                    description={t("anomalies.empty.description")}
                  />
                )
              }
            />
          )}
        </div>
      </PageContent>
      <AnomalyDrawer
        anomaly={open}
        all={items}
        now={now}
        canWrite={canWrite}
        onResolve={onResolve}
        resolving={resolve.isPending}
        onOpenChange={(next) => !next && setOpenId(null)}
      />
    </PageTabs>
  );
}

/** Search by account or address, then status and kind, each with its count; under it, what's applied. */
function AnomaliesToolbar({
  filters,
  onFiltersChange,
  items,
  shown,
}: {
  filters: AnomalyFilters;
  onFiltersChange: (next: AnomalyFilters) => void;
  items: readonly Anomaly[];
  shown: number;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<AnomalyFilters>) => onFiltersChange({ ...filters, ...patch });
  const openCount = items.filter((a) => !isAnomalyResolved(a)).length;

  const tags: AppliedFilter[] = [];
  if (filters.status)
    tags.push({
      id: "status",
      label: t("anomalies.filters.status"),
      value: t(`anomalies.status.${filters.status}`),
    });
  if (filters.type)
    tags.push({
      id: "type",
      label: t("anomalies.filters.type"),
      value: t(`anomalies.type.${filters.type}`),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("anomalies.filters.search")}
          placeholder={t("anomalies.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("anomalies.filters.status")}
          className="ppl-filter"
          value={filters.status ?? ANY}
          onValueChange={(value) =>
            set({ status: value === "open" || value === "resolved" ? value : undefined })
          }
          items={[
            { value: ANY, label: t("anomalies.filters.anyStatus") },
            { value: "open", label: `${t("anomalies.status.open")} · ${n(openCount)}` },
            {
              value: "resolved",
              label: `${t("anomalies.status.resolved")} · ${n(items.length - openCount)}`,
            },
          ]}
        />
        <Select
          aria-label={t("anomalies.filters.type")}
          className="ppl-filter"
          value={filters.type ?? ANY}
          onValueChange={(value) => set({ type: ANOMALY_TYPES.find((type) => type === value) })}
          items={[
            { value: ANY, label: t("anomalies.filters.anyType") },
            ...ANOMALY_TYPES.map((type) => ({
              value: type,
              label: `${t(`anomalies.type.${type}`)} · ${n(items.filter((a) => a.type === type).length)}`,
            })),
          ]}
        />
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with none,
          QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("anomalies.filters.summary", { n: n(shown), total: n(items.length) })}
        />
      ) : null}
    </div>
  );
}
