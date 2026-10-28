// Overview › Activity: the organisation's audit log as a list, live while its range runs up to
// now. Filters, the range, the applied saved view and the open event live in the address, so any
// view is a link someone can share.

import { ActivityIcon, DownloadIcon, PauseIcon, PlayIcon, SearchXIcon } from "@qeetrix/icons";
import {
  Button,
  formatDateTime,
  formatNumber,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Tab,
  Table,
  Tabs,
  TabsList,
} from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useEntitlements } from "@/modules/billing";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { useActivityExport } from "@/modules/activity/activity-export";
import { applyFilters } from "@/modules/activity/activity-filters";
import { useActivityHistory } from "@/modules/activity/activity-history";
import { useLiveActivity } from "@/modules/activity/activity-live";
import {
  ACTIVITY_TABS,
  type ActivitySearch,
  type ActivityTab,
  rangeOf,
  searchToFilters,
  TAB_SEVERITY,
  tabOf,
} from "@/modules/activity/activity-search";
import { useActivitySummary } from "@/modules/activity/activity-summary";
import { eventActor, knownTotal } from "@/modules/activity/activity-view";
import { activityKeys } from "@/modules/activity/api/keys";
import { formatEventTitle } from "@/modules/activity/event-labels";
import { viewSearch } from "@/modules/activity/saved-views";
import type { ActivityEvent } from "@/modules/activity/types/activity.types";
import { ActivityEventDrawer } from "../drawer/event-drawer";
import { ActivityBand } from "./activity-band";
import { BandPlaceholder, LiveBadge, LiveNotice, tabBadge } from "./activity-live-parts";
import { ActivityRowActions, useActivityColumns } from "./activity-table";
import { ActivityToolbar } from "./activity-toolbar";
import "./activity-list.css";

type SearchUpdate = (prev: ActivitySearch) => ActivitySearch;

/** The activity page's URL search, which the route owns. */
export interface ActivityPageProps {
  search: ActivitySearch;
  onSearchChange: (update: SearchUpdate, options?: { replace?: boolean }) => void;
}

const PAGE_SIZES = [25, 50, 100] as const;
const NO_EVENTS: ActivityEvent[] = [];
// Past this many events read without filling a page (a filter only the browser applies), the
// list stops reading further back until asked.
const SCAN_STEP = 2_000;

export function ActivityPage({ search, onSearchChange }: ActivityPageProps) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);

  // The filters, without the open event or the applied view: opening an event mustn't move a
  // relative range's start, or the list would load again.
  const filterKey = JSON.stringify(viewSearch(search));
  // biome-ignore lint/correctness/useExhaustiveDependencies: resolved once per set of filters
  const filters = useMemo(() => searchToFilters(search), [filterKey]);
  const range = rangeOf(search);
  const tab = tabOf(search.severity);

  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const [scanLimit, setScanLimit] = useState(SCAN_STEP);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new filters start from the top
  useEffect(() => {
    setOffset(0);
    setScanLimit(SCAN_STEP);
  }, [filterKey]);

  const historyQ = useActivityHistory(filters);
  const historyEvents = useMemo(
    () => historyQ.data?.pages.flatMap((p) => p.events),
    [historyQ.data],
  );
  const live = useLiveActivity({
    filters,
    history: historyEvents,
    enabled: true,
    onFirstPage: offset === 0,
    onGap: () =>
      void queryClient.resetQueries({ queryKey: activityKeys.history(tenantId, filters) }),
  });
  const summaryQ = useActivitySummary(filters, { live: live.status === "live" });
  const summary = summaryQ.data;

  // Newer events first, then the loaded log, each event once; then what the browser filters.
  const events = useMemo(() => {
    const merged = live.merged;
    if (!merged.length) return historyEvents ?? NO_EVENTS;
    const ids = new Set(merged.map((e) => e.id));
    return [...merged, ...(historyEvents ?? NO_EVENTS).filter((e) => !ids.has(e.id))];
  }, [live.merged, historyEvents]);
  const shown = useMemo(() => applyFilters(events, filters), [events, filters]);

  const start = offset < shown.length ? offset : 0;
  const onPage = shown.slice(start, start + pageSize);
  const known = knownTotal(summary, filters);
  const total = !historyQ.hasNextPage
    ? historyQ.data
      ? shown.length
      : undefined
    : known !== undefined
      ? Math.max(known, shown.length)
      : undefined;

  // Read further back while this page isn't full, up to the scan limit.
  const loadedCount = historyEvents?.length ?? 0;
  const wantMore = start + pageSize > shown.length && historyQ.hasNextPage;
  const scanCapped = wantMore && loadedCount >= scanLimit;
  const { fetchNextPage, isFetchingNextPage } = historyQ;
  useEffect(() => {
    if (wantMore && !scanCapped && !isFetchingNextPage) void fetchNextPage();
  }, [wantMore, scanCapped, isFetchingNextPage, fetchNextPage]);

  const patch = useCallback(
    (next: Partial<ActivitySearch>) =>
      onSearchChange((prev) => ({ ...prev, view: undefined, ...next }), { replace: true }),
    [onSearchChange],
  );
  const openEvent = useCallback(
    (id: string | undefined) =>
      onSearchChange((prev) => ({ ...prev, event: id }), { replace: true }),
    [onSearchChange],
  );

  const columns = useActivityColumns({
    newIds: live.newIds,
    now: Math.max(historyQ.dataUpdatedAt, live.checkedAt) || Date.now(),
  });
  const canExport = useEntitlements().data?.features.audit_export !== false;
  const { exportAll, exporting } = useActivityExport(filters);

  const rangeWords =
    range === "custom"
      ? shortRange(filters.from, filters.to, locale)
      : t(`activityTimeRange.presets.${range}`).toLocaleLowerCase(locale);
  // The summary covers at most 90 days back from the range's end.
  const clamped =
    !!summary &&
    !!filters.from &&
    Date.parse(summary.window.from) - Date.parse(filters.from) > 60_000;
  const filtered =
    !!search.q ||
    !!search.actor ||
    !!search.type ||
    !!search.ip ||
    !!search.resource ||
    !!search.category ||
    (!!search.severity && tab === "all");

  const tabCount = (which: ActivityTab) =>
    knownTotal(summary, { ...filters, severity: severityOfTab(which) });
  const isLive = live.status !== "off";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        patch({ severity: TAB_SEVERITY[(value as ActivityTab) ?? "all"], event: undefined })
      }
    >
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        status={isLive ? <LiveBadge status={live.status} /> : undefined}
        description={[
          org ? t("page.description", { org: org.name }) : t("page.descriptionNoName"),
          live.status === "live" ? t("page.liveNote") : "",
        ]
          .filter(Boolean)
          .join(" ")}
        actions={
          <>
            {isLive ? (
              live.status === "paused" ? (
                <Button variant="ghost" icon={PlayIcon} onClick={live.resume}>
                  {t("page.resume")}
                </Button>
              ) : (
                <Button variant="ghost" icon={PauseIcon} onClick={live.pause}>
                  {t("page.pause")}
                </Button>
              )
            ) : null}
            {canExport ? (
              <Menu>
                <MenuTrigger
                  render={
                    <Button variant="soft" icon={DownloadIcon} loading={!!exporting}>
                      {exporting ? t("page.exporting") : t("page.export")}
                    </Button>
                  }
                />
                <MenuContent align="end">
                  {/* File formats, named as their tools name them. */}
                  <MenuItem onClick={() => void exportAll("csv")}>CSV</MenuItem>
                  <MenuItem onClick={() => void exportAll("json")}>JSON</MenuItem>
                  <MenuItem onClick={() => void exportAll("ndjson")}>NDJSON</MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
          </>
        }
        summary={
          summary ? (
            <ActivityBand summary={summary} range={rangeWords} clamped={clamped} />
          ) : summaryQ.isLoading ? (
            <BandPlaceholder />
          ) : undefined
        }
        tabs={
          <TabsList aria-label={t("page.tabs.label")}>
            {ACTIVITY_TABS.map((which) => (
              <Tab key={which} value={which} badge={tabBadge(which, tabCount(which), n)}>
                {t(`page.tabs.${which}`)}
              </Tab>
            ))}
          </TabsList>
        }
      />
      <PageContent>
        <div className="ppl act">
          <LiveNotice
            status={live.status}
            pausedAt={live.pausedAt}
            pending={live.pending}
            onResume={live.resume}
            onNewest={() => setOffset(0)}
          />
          {historyQ.isError ? (
            <DataState error={historyQ.error} onRetry={() => void historyQ.refetch()} />
          ) : (
            <>
              <Table<ActivityEvent>
                label={t("table.label")}
                rows={onPage}
                rowId={(e) => e.id}
                rowLabel={(e) =>
                  t("table.rowLabel", {
                    title: formatEventTitle(e),
                    actor: eventActor(e).name,
                    when: formatDateTime(e.at, locale),
                  })
                }
                columns={columns}
                loading={historyQ.isLoading || (onPage.length < pageSize && isFetchingNextPage)}
                onRowClick={(e) => openEvent(e.id)}
                rowActions={(e) => (
                  <ActivityRowActions
                    event={e}
                    onOpen={() => openEvent(e.id)}
                    onFilter={(next) => patch({ ...next, event: undefined })}
                  />
                )}
                toolbar={
                  <ActivityToolbar
                    search={search}
                    filters={filters}
                    summary={summary}
                    events={events}
                    total={total}
                    onChange={(next) => patch({ ...next, event: undefined })}
                    onApplyView={(view) =>
                      // A normal push, so Back returns to the view before.
                      onSearchChange(() => ({ ...view.search, view: view.id }))
                    }
                  />
                }
                empty={
                  <EmptyState
                    size="section"
                    icon={filtered ? SearchXIcon : ActivityIcon}
                    title={
                      search.q
                        ? t("table.empty.searchTitle", { q: search.q })
                        : filtered
                          ? t("table.empty.filteredTitle")
                          : tab !== "all"
                            ? t(`table.empty.none.${tab}`)
                            : range === "custom"
                              ? t("table.empty.titleCustom")
                              : t("table.empty.title", { range: rangeWords })
                    }
                    description={
                      filtered
                        ? t("table.empty.filteredDescription")
                        : tab !== "all"
                          ? t("table.empty.tryLonger")
                          : t("table.empty.description")
                    }
                    actions={
                      filtered ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            onSearchChange(
                              (prev) => ({ range: prev.range, from: prev.from, to: prev.to }),
                              { replace: true },
                            )
                          }
                        >
                          {t("table.empty.clear")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              {scanCapped ? (
                <Alert
                  tone="info"
                  title={t("table.scanned.title", { n: n(loadedCount) })}
                  actions={
                    <Button variant="ghost" onClick={() => setScanLimit((l) => l + SCAN_STEP)}>
                      {t("table.scanned.more")}
                    </Button>
                  }
                >
                  {t("table.scanned.body")}
                </Alert>
              ) : null}
              {shown.length > 0 ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={total}
                  loading={isFetchingNextPage}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setOffset(0);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>

      <ActivityEventDrawer
        eventId={search.event ?? null}
        event={search.event ? events.find((e) => e.id === search.event) : undefined}
        onClose={() => openEvent(undefined)}
        onOpenEvent={openEvent}
        onShowActorEvents={(actor) =>
          onSearchChange((prev) => ({
            range: prev.range,
            from: prev.from,
            to: prev.to,
            actor: actor.id,
          }))
        }
      />
    </Tabs>
  );
}

function severityOfTab(tab: ActivityTab) {
  return tab === "failed"
    ? (["error", "critical"] as const).slice()
    : tab === "critical"
      ? (["critical"] as const).slice()
      : [];
}

/** A custom range in few words, "27–28 Oct" (with the year when it isn't this one). */
function shortRange(from: string, to: string, locale: string) {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  const thisYear =
    start.getFullYear() === new Date().getFullYear() && end.getFullYear() === start.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: thisYear ? undefined : "numeric",
    timeZone: "Asia/Kolkata",
  }).formatRange(start, end);
}
