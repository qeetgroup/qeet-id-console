// Activity and audit investigation: the live SSE feed plus the audit history. All filter, time,
// mode, view and selection state lives in the URL, so any view can be shared by pasting it.

import { Button, EmptyState, Input, Separator } from "@qeetrix/ui";
import {
  ActivityIcon,
  BoxIcon,
  GlobeIcon,
  LayersIcon,
  SearchIcon,
  TargetIcon,
  UserIcon,
} from "@qeetrix/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useActivityExport } from "../activity-export";
import { ActivityProvider, useActivity } from "../activity-provider";
import {
  type ActivitySearch,
  DEFAULT_MODE,
  OUTCOME_TO_SEVERITY,
  searchToFilters,
  severityToOutcome,
} from "../activity-search";
import { useActivitySummary } from "../activity-summary";
import { ActivityModeToggle } from "./activity-mode-toggle";
import { ActivityPagination } from "./activity-pagination";
import { ActivitySavedViews } from "./activity-saved-views";
import { ActivitySummaryStrip } from "./activity-summary-strip";
import { ActivityTimeRange, type DateRange } from "@/modules/activity";
import { ActivityTimeline } from "./activity-timeline";
import { EventDetailsDrawer } from "./event-details-drawer";
import { LiveIndicator } from "@/modules/activity";
import { extractFilterOptions, groupByDate } from "@/modules/activity";
import { ALL_EVENTS_VIEW_ID, hydrateSavedViews, type SavedView } from "../saved-views";
import type { ActivityFilters, ActivityMode, Outcome } from "@/modules/activity";
import { useEntitlements } from "@/modules/billing";
import { useStorageScope } from "@/platform/auth/scoped-storage";
import {
  CATEGORY_OPTIONS,
  ExportMenu,
  FacetSelect,
  filtersPatchToSearch,
  OUTCOME_OPTIONS,
  prettify,
} from "./activity-toolbar";

type SearchUpdate = (prev: ActivitySearch) => ActivitySearch;

/** The activity page's URL search, which the route owns. */
export interface ActivityPageProps {
  search: ActivitySearch;
  onSearchChange: (update: SearchUpdate, options?: { replace?: boolean }) => void;
}

/** Renders the activity feed: live or history, filters, saved views, export and event details. */
export function ActivityPage({ search, onSearchChange }: ActivityPageProps) {
  const filters = useMemo(() => searchToFilters(search), [search]);

  const storageScope = useStorageScope();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on scope change
  useEffect(() => {
    hydrateSavedViews();
  }, [storageScope]);

  // Filter changes from context consumers go through the URL too.
  const onFiltersChange = useCallback(
    (patch: Partial<ActivityFilters>) => {
      onSearchChange((prev) => ({ ...prev, ...filtersPatchToSearch(patch), view: undefined }), {
        replace: true,
      });
    },
    [onSearchChange],
  );

  return (
    <ActivityProvider filters={filters} onFiltersChange={onFiltersChange}>
      <ActivityWorkspace search={search} onSearchChange={onSearchChange} />
    </ActivityProvider>
  );
}

function ActivityWorkspace({ search, onSearchChange }: ActivityPageProps) {
  const access = useCapabilities();
  const canRead = access.can("audit.read");

  const {
    filteredEvents,
    allEvents,
    unreadCount,
    status,
    filters,
    markAllRead,
    pause,
    resume,
    isLoadingHistory,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    newEventIds,
    isHistoryError,
    retryHistory,
    retryStream,
  } = useActivity();

  const mode: ActivityMode = search.mode ?? DEFAULT_MODE;
  const timelineRef = useRef<HTMLDivElement>(null);

  const summaryQ = useActivitySummary(filters, { live: mode === "live", enabled: canRead });
  const activeOutcome = severityToOutcome(filters.severity);

  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter identity
  useEffect(() => setPage(0), [filters]);

  const loadedPages = Math.ceil(filteredEvents.length / pageSize);
  // True total: exact once history is fully loaded; else the server's window total.
  const total = hasNextPage
    ? Math.max(filteredEvents.length, summaryQ.data?.total ?? filteredEvents.length)
    : filteredEvents.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Clamp the page if the loaded set shrank below it (e.g. after filtering).
  const clampedPage = Math.min(page, Math.max(0, loadedPages - 1));
  const pageEvents = useMemo(
    () => filteredEvents.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize),
    [filteredEvents, clampedPage, pageSize],
  );
  const pageGroups = useMemo(() => groupByDate(pageEvents), [pageEvents]);

  // Fetch more history when the requested page runs past the loaded set.
  useEffect(() => {
    const needed = (page + 1) * pageSize;
    if (needed > filteredEvents.length && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [page, pageSize, filteredEvents.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Export is a paid feature, but it runs client-side, so this gate is UI only.
  const canExport = useEntitlements().data?.features.audit_export !== false;
  const { exportAll, exporting } = useActivityExport(filters);

  // Mode drives the SSE pause state: History freezes the feed, Live resumes it.
  useEffect(() => {
    if (mode === "history") pause();
    else resume();
  }, [mode, pause, resume]);

  const patchFilter = useCallback(
    (partial: Partial<ActivitySearch>) => {
      // A filter change deselects any applied saved view unless the patch sets one.
      onSearchChange((prev) => ({ ...prev, view: undefined, ...partial }), { replace: true });
    },
    [onSearchChange],
  );
  const patchDrawer = useCallback(
    (partial: Partial<ActivitySearch>) => {
      onSearchChange((prev) => ({ ...prev, ...partial }), { replace: true });
    },
    [onSearchChange],
  );

  const preset = search.range ?? "all";
  const customRange = useMemo<DateRange | undefined>(
    () =>
      search.range === "custom" && search.from
        ? { from: new Date(search.from), to: search.to ? new Date(search.to) : undefined }
        : undefined,
    [search.range, search.from, search.to],
  );
  const handlePresetChange = useCallback(
    (p: string) => {
      if (p === "custom") patchFilter({ range: "custom" });
      else patchFilter({ range: p === "all" ? undefined : p, from: undefined, to: undefined });
    },
    [patchFilter],
  );
  const handleCustomRangeChange = useCallback(
    (range: DateRange | undefined) => {
      patchFilter({
        range: "custom",
        from: range?.from?.toISOString(),
        to: range?.to?.toISOString(),
      });
    },
    [patchFilter],
  );

  const handleCategory = useCallback(
    (v: string) => patchFilter({ category: v || undefined }),
    [patchFilter],
  );
  const handleOutcome = useCallback(
    (v: string) =>
      patchFilter({ severity: v ? OUTCOME_TO_SEVERITY[v as Outcome].join(",") : undefined }),
    [patchFilter],
  );

  // Search is committed on submit, to avoid a navigation per keystroke.
  const [searchDraft, setSearchDraft] = useState(filters.q);
  useEffect(() => setSearchDraft(filters.q), [filters.q]);

  const facetOptions = useMemo(() => extractFilterOptions(allEvents), [allEvents]);
  const actorOptions = facetOptions.actors;
  const resourceOptions = useMemo(
    () => facetOptions.resources.map((r) => ({ value: r, label: prettify(r) })),
    [facetOptions.resources],
  );
  const handleActor = useCallback(
    (v: string) => patchFilter({ actor: v || undefined }),
    [patchFilter],
  );
  const handleResource = useCallback(
    (v: string) => patchFilter({ resource: v || undefined }),
    [patchFilter],
  );

  const applyView = useCallback(
    (view: SavedView) => {
      // Apply with a normal push so Back returns to the previous view.
      onSearchChange(() => ({ ...view.search, view: view.id }));
    },
    [onSearchChange],
  );

  const hasAnyFilter =
    !!filters.q ||
    !!filters.ip ||
    !!filters.actor ||
    !!filters.resource ||
    !!filters.source ||
    filters.types.length > 0 ||
    filters.severity.length > 0 ||
    filters.category.length > 0 ||
    preset !== "all" ||
    !!search.view;
  const clearAll = useCallback(() => {
    onSearchChange((prev) => ({ mode: prev.mode }));
  }, [onSearchChange]);

  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === search.event) ?? null,
    [allEvents, search.event],
  );
  const selectedIndex = useMemo(
    () => filteredEvents.findIndex((e) => e.id === search.event),
    [filteredEvents, search.event],
  );
  const prevEvent = selectedIndex > 0 ? filteredEvents[selectedIndex - 1] : null;
  const nextEvent =
    selectedIndex >= 0 && selectedIndex < filteredEvents.length - 1
      ? filteredEvents[selectedIndex + 1]
      : null;

  const handleSelectEvent = useCallback(
    (event: { id: string }) => {
      patchDrawer({ event: event.id, tab: search.tab ?? "overview" });
      markAllRead();
    },
    [patchDrawer, search.tab, markAllRead],
  );
  const closeDrawer = useCallback(
    () => patchDrawer({ event: undefined, tab: undefined }),
    [patchDrawer],
  );

  const handleModeChange = useCallback(
    (m: ActivityMode) => patchFilter({ mode: m }),
    [patchFilter],
  );
  const jumpToNew = useCallback(() => {
    markAllRead();
    setPage(0);
    const vp = timelineRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    vp?.scrollTo({ top: 0, behavior: "smooth" });
  }, [markAllRead]);

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
    timelineRef.current
      ?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
      ?.scrollTo({ top: 0 });
  }, []);

  if (!canRead) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader />
        <div className="enterprise-panel flex min-h-64 items-center justify-center">
          <EmptyState
            icon={ActivityIcon}
            title="Activity not available"
            description={
              <>
                You don't have permission to view the activity feed. Contact your organization admin
                to request the <code className="font-mono">audit.read</code> capability.
              </>
            }
          />
        </div>
      </div>
    );
  }

  const hasCritical = filteredEvents.some(
    (e) => newEventIds.has(e.id) && (e.severity === "critical" || e.severity === "error"),
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description="Monitor authentication, identity, access, and security events across your organization."
        actions={
          <>
            <LiveIndicator status={status} unreadCount={unreadCount} className="flex-wrap" />
            {canExport && <ExportMenu exporting={exporting} onExport={exportAll} />}
          </>
        }
      />

      {/* Critical event announcement for screen readers */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {hasCritical ? `${unreadCount} critical or error events require attention` : ""}
      </div>

      {/* Sticky toolbar */}
      <div className="activity-toolbar flex flex-col gap-3 p-3">
        {/* Row 1 — time range + live/history + environment */}
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTimeRange
            preset={preset}
            customRange={customRange}
            onPresetChange={handlePresetChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
          <ActivityModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            newCount={unreadCount}
            onJumpToNew={jumpToNew}
          />
        </div>

        <Separator />

        {/* Row 2 — faceted dropdowns + search */}
        <div className="flex flex-wrap items-center gap-2">
          <FacetSelect
            label="All events"
            value={filters.category[0] ?? ""}
            onChange={handleCategory}
            options={CATEGORY_OPTIONS}
            icon={LayersIcon}
          />
          <FacetSelect
            label="All outcomes"
            value={activeOutcome}
            onChange={handleOutcome}
            options={OUTCOME_OPTIONS}
            icon={TargetIcon}
          />
          <FacetSelect
            label="All actors"
            value={filters.actor}
            onChange={handleActor}
            options={actorOptions}
            icon={UserIcon}
          />
          <FacetSelect
            label="All resources"
            value={filters.resource}
            onChange={handleResource}
            options={resourceOptions}
            icon={BoxIcon}
          />
          <FacetSelect
            label="All environments"
            value="production"
            onChange={() => {}}
            options={[{ value: "production", label: "Production" }]}
            icon={GlobeIcon}
          />
          <form
            className="relative min-w-48 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              patchFilter({ q: searchDraft || undefined });
            }}
          >
            <SearchIcon
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search events by keyword, ID, IP, user… (press Enter)"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-8"
              aria-label="Search activity events"
            />
          </form>
          {hasAnyFilter && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>

        <Separator />

        {/* Row 3 — saved views */}
        <ActivitySavedViews
          activeViewId={search.view ?? (hasAnyFilter ? undefined : ALL_EVENTS_VIEW_ID)}
          currentSearch={search}
          onApply={applyView}
        />
      </div>

      {/* Summary metric strip */}
      <ActivitySummaryStrip
        summary={summaryQ.data}
        isLoading={summaryQ.isLoading}
        onApplyFilter={patchFilter}
        activeOutcome={activeOutcome}
      />

      {/* Timeline table + numbered pagination */}
      <div ref={timelineRef} className="enterprise-panel flex min-h-96 flex-col overflow-hidden">
        <ActivityTimeline
          groups={pageGroups}
          newEventIds={newEventIds}
          status={status}
          isLoadingHistory={isLoadingHistory}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={false}
          onLoadMore={fetchNextPage}
          onSelectEvent={handleSelectEvent}
          onFilter={patchFilter}
          selectedEventId={search.event}
          isError={isHistoryError}
          onRetryHistory={retryHistory}
          onRetryStream={retryStream}
          hideEndMarker
        />
        {pageGroups.length > 0 && (
          <ActivityPagination
            page={clampedPage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            itemsOnPage={pageEvents.length}
            onPageChange={handlePageChange}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            loading={isFetchingNextPage}
          />
        )}
      </div>

      {/* Details drawer */}
      <EventDetailsDrawer
        event={selectedEvent}
        prevEvent={prevEvent}
        nextEvent={nextEvent}
        activeTab={search.tab ?? "overview"}
        onTabChange={(tab) => patchDrawer({ tab })}
        onClose={closeDrawer}
        onSelectPrev={prevEvent ? () => handleSelectEvent(prevEvent) : undefined}
        onSelectNext={nextEvent ? () => handleSelectEvent(nextEvent) : undefined}
        onSelectEvent={handleSelectEvent}
        onFilter={patchFilter}
      />
    </div>
  );
}
