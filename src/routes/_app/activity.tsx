// Activity & Audit — enterprise investigation workspace.
// A live SSE feed + historical audit log, rendered as: a summary metric strip,
// a sticky filter/saved-view toolbar, dense grouped rows, and a right-side
// details drawer. All filter/time/mode/view/selection state lives in the URL
// (validateSearch), so any view is paste-shareable.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  ActivityIcon,
  BoxIcon,
  DownloadIcon,
  GlobeIcon,
  LayersIcon,
  Loader2Icon,
  SearchIcon,
  TargetIcon,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/platform/components/page-header";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useActivityExport } from "@/modules/activity/activity-export";
import { ActivityProvider, useActivity } from "@/modules/activity/activity-provider";
import {
  type ActivitySearch,
  arrayToCsv,
  DEFAULT_MODE,
  OUTCOME_TO_SEVERITY,
  searchToFilters,
  severityToOutcome,
  validateActivitySearch,
} from "@/modules/activity/activity-search";
import { useActivitySummary } from "@/modules/activity/activity-summary-service";
import { ActivityModeToggle } from "@/modules/activity/components/activity-mode-toggle";
import { ActivityPagination } from "@/modules/activity/components/activity-pagination";
import { ActivitySavedViews } from "@/modules/activity/components/activity-saved-views";
import { ActivitySummaryStrip } from "@/modules/activity/components/activity-summary-strip";
import {
  ActivityTimeRange,
  type DateRange,
} from "@/modules/activity/components/activity-time-range";
import { ActivityTimeline } from "@/modules/activity/components/activity-timeline";
import { EventDetailsDrawer } from "@/modules/activity/components/event-details-drawer";
import { LiveIndicator } from "@/modules/activity/components/live-indicator";
import { extractFilterOptions, groupByDate } from "@/modules/activity/filter-manager";
import {
  ALL_EVENTS_VIEW_ID,
  hydrateSavedViews,
  type SavedView,
} from "@/modules/activity/saved-views";
import type { ActivityFilters, ActivityMode, Outcome } from "@/modules/activity/types";
import { useEntitlements } from "@/modules/billing/api/billing";

export const Route = createFileRoute("/_app/activity")({
  component: ActivityRouteComponent,
  validateSearch: validateActivitySearch,
});

// Fixed catalogs for the quick-filter dropdowns.
const CATEGORY_OPTIONS = [
  { value: "authentication", label: "Authentication" },
  { value: "authorization", label: "Authorization" },
  { value: "security", label: "Security" },
  { value: "directory", label: "Directory" },
  { value: "developer", label: "Developer" },
  { value: "system", label: "System" },
];

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "failed", label: "Failed" },
  { value: "info", label: "Info" },
];

function prettify(v: string): string {
  if (v.includes(".")) return v;
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/[_-]/g, " ");
}

// Maps an ActivityFilters patch (from context setFilters) onto URL search params.
// Time (from/to) is owned by the range control and intentionally excluded.
function filtersPatchToSearch(patch: Partial<ActivityFilters>): Partial<ActivitySearch> {
  const s: Partial<ActivitySearch> = {};
  if (patch.types !== undefined) s.type = arrayToCsv(patch.types);
  if (patch.severity !== undefined) s.severity = arrayToCsv(patch.severity);
  if (patch.category !== undefined) s.category = arrayToCsv(patch.category);
  if (patch.actor !== undefined) s.actor = patch.actor || undefined;
  if (patch.source !== undefined) s.source = patch.source || undefined;
  if (patch.status !== undefined) s.status = patch.status || undefined;
  if (patch.ip !== undefined) s.ip = patch.ip || undefined;
  if (patch.resource !== undefined) s.resource = patch.resource || undefined;
  if (patch.q !== undefined) s.q = patch.q || undefined;
  return s;
}

// ---------------------------------------------------------------------------
// Small inline controls
// ---------------------------------------------------------------------------

function FacetSelect({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  icon: typeof ActivityIcon;
}) {
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : (v ?? ""))}>
      <SelectTrigger className="w-40 gap-2" aria-label={label}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ExportMenu({
  exporting,
  onExport,
}: {
  exporting: "csv" | "json" | "ndjson" | null;
  onExport: (f: "csv" | "json" | "ndjson") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={!!exporting}>
            {exporting ? (
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon className="size-3.5" aria-hidden="true" />
            )}
            {exporting ? `Exporting ${exporting.toUpperCase()}…` : "Export"}
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-36">
        <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("json")}>JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("ndjson")}>NDJSON</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Route component (owns URL ⇄ filters) + provider
// ---------------------------------------------------------------------------

function ActivityRouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = useMemo(() => searchToFilters(search), [search]);

  useEffect(() => {
    hydrateSavedViews();
  }, []);

  // Context consumers (e.g. FilterBar via setFilters) route through the URL.
  const onFiltersChange = useCallback(
    (patch: Partial<ActivityFilters>) => {
      navigate({
        search: (prev) => ({ ...prev, ...filtersPatchToSearch(patch), view: undefined }),
        replace: true,
      });
    },
    [navigate],
  );

  return (
    <ActivityProvider filters={filters} onFiltersChange={onFiltersChange}>
      <ActivityWorkspace />
    </ActivityProvider>
  );
}

// ---------------------------------------------------------------------------
// Workspace (inside the provider)
// ---------------------------------------------------------------------------

function ActivityWorkspace() {
  const access = useCapabilities();
  const canRead = access.can("audit.read");
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

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

  // Summary snapshot (windowed; polled only in live mode).
  const summaryQ = useActivitySummary(filters, { live: mode === "live", enabled: canRead });
  const activeOutcome = severityToOutcome(filters.severity);

  // ── Numbered pagination over the loaded (filtered) events ──────────────────
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  // Reset to the first page whenever the filter set changes.
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

  // Export (paid feature; export is client-side so the gate is UI-only).
  const canExport = useEntitlements().data?.features.audit_export !== false;
  const { exportAll, exporting } = useActivityExport(filters);

  // Mode drives the SSE pause state: History freezes the feed, Live resumes it.
  useEffect(() => {
    if (mode === "history") pause();
    else resume();
  }, [mode, pause, resume]);

  // ── URL mutation helpers ───────────────────────────────────────────────────
  const patchFilter = useCallback(
    (partial: Partial<ActivitySearch>) => {
      // A filter change deselects any applied saved view unless the patch sets one.
      navigate({
        search: (prev) => ({ ...prev, view: undefined, ...partial }),
        replace: true,
      });
    },
    [navigate],
  );
  const patchDrawer = useCallback(
    (partial: Partial<ActivitySearch>) => {
      navigate({ search: (prev) => ({ ...prev, ...partial }), replace: true });
    },
    [navigate],
  );

  // ── Time range ─────────────────────────────────────────────────────────────
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

  // ── Quick facets ───────────────────────────────────────────────────────────
  const handleCategory = useCallback(
    (v: string) => patchFilter({ category: v || undefined }),
    [patchFilter],
  );
  const handleOutcome = useCallback(
    (v: string) =>
      patchFilter({ severity: v ? OUTCOME_TO_SEVERITY[v as Outcome].join(",") : undefined }),
    [patchFilter],
  );

  // ── Search (committed on submit to avoid per-keystroke navigations) ─────────
  const [searchDraft, setSearchDraft] = useState(filters.q);
  useEffect(() => setSearchDraft(filters.q), [filters.q]);

  // Actor / resource facet options are derived from the loaded events.
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

  // ── Saved views ────────────────────────────────────────────────────────────
  const applyView = useCallback(
    (view: SavedView) => {
      // Apply with a normal push so Back returns to the previous view.
      navigate({ search: () => ({ ...view.search, view: view.id }) });
    },
    [navigate],
  );

  // ── Clear all ──────────────────────────────────────────────────────────────
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
    navigate({ search: (prev) => ({ mode: prev.mode }) });
  }, [navigate]);

  // ── Drawer / selection ─────────────────────────────────────────────────────
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

  // ── Live/history + jump-to-new ─────────────────────────────────────────────
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
