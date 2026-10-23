import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
} from "@qeetrix/ui";
import { ChevronDownIcon, ListFilterIcon, SearchIcon, XIcon } from "@qeetrix/icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCapabilities } from "@/platform/security/capability-provider";
import { ActivityTimeRange, type DateRange, presetToRange, TIME_PRESETS } from "@/modules/activity";
import type { Severity } from "@/modules/activity";
import { useTimeline } from "../timeline-provider";

// Labelled `timeline:category.<value>`; severities share `activity:severity.<value>`.
const CATEGORIES = [
  "authentication",
  "authorization",
  "security",
  "provisioning",
  "organizations",
  "groups",
  "policies",
  "applications",
  "devices",
  "sessions",
  "api",
  "administration",
] as const;

const SEVERITY_OPTIONS: { value: Severity; dot: string }[] = [
  { value: "info", dot: "bg-info" },
  { value: "success", dot: "bg-success" },
  { value: "warning", dot: "bg-warning" },
  { value: "error", dot: "bg-destructive" },
  { value: "critical", dot: "bg-destructive" },
];

const PRESETS = new Set(TIME_PRESETS.map((p) => p.value));

function FilterDropdown({
  label,
  heading,
  count,
  disabled,
  children,
}: {
  label: string;
  heading: string;
  count: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
            {label}
            {count > 0 && (
              <span className="grid min-w-4 place-items-center rounded bg-primary/15 px-1 text-[10px] font-semibold tabular-nums text-primary">
                {count}
              </span>
            )}
            <ChevronDownIcon className="size-3.5 opacity-60" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{heading}</DropdownMenuLabel>
          {children}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pe-1.5 ps-2.5 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="truncate">{label}</span>
      <XIcon className="size-3 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/**
 * Renders the timeline filter bar: search, time range, category and severity menus, and a
 * removable chip per active filter. Disabled without audit.read and user.read.
 */
export function TimelineFilters() {
  const { t } = useTranslation("timeline");
  const access = useCapabilities();
  const disabled = !access.can("audit.read") || !access.can("user.read");

  const { filters, setFilters, resetFilters } = useTimeline();

  // The preset is local UI state; only its resolved from/to window goes into the filter store.
  const [preset, setPreset] = useState("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  const hasActiveFilters =
    filters.category.length > 0 ||
    filters.severity.length > 0 ||
    !!filters.q ||
    !!filters.from ||
    !!filters.to;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFilters({ q: e.target.value }),
    [setFilters],
  );

  const toggleCategory = useCallback(
    (value: string) => {
      const next = filters.category.includes(value)
        ? filters.category.filter((v) => v !== value)
        : [...filters.category, value];
      setFilters({ category: next });
    },
    [filters.category, setFilters],
  );

  const toggleSeverity = useCallback(
    (value: Severity) => {
      const next = filters.severity.includes(value)
        ? filters.severity.filter((v) => v !== value)
        : [...filters.severity, value];
      setFilters({ severity: next });
    },
    [filters.severity, setFilters],
  );

  const handlePresetChange = useCallback(
    (next: string) => {
      setPreset(next);
      if (next !== "custom") {
        setCustomRange(undefined);
        setFilters(presetToRange(next));
      }
    },
    [setFilters],
  );

  const handleCustomRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setCustomRange(range);
      setFilters(presetToRange("custom", range));
    },
    [setFilters],
  );

  const clearDate = useCallback(() => {
    setPreset("all");
    setCustomRange(undefined);
    setFilters({ from: "", to: "" });
  }, [setFilters]);

  const handleClearAll = useCallback(() => {
    setPreset("all");
    setCustomRange(undefined);
    resetFilters();
  }, [resetFilters]);

  // An unknown preset gets an empty chip label.
  const dateChipLabel =
    preset !== "all" && preset !== "custom"
      ? PRESETS.has(preset)
        ? t(`activity:activityTimeRange.presets.${preset}`)
        : ""
      : preset === "custom"
        ? t("timelineFilters.customRange")
        : t("timelineFilters.dateRange");

  return (
    <fieldset
      className="m-0 flex flex-col gap-3 border-0 p-0"
      aria-label={t("timelineFilters.timelineFilters")}
    >
      {/* Primary row: search + time range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={t("timelineFilters.searchEventsUsersIps")}
            value={filters.q}
            onChange={handleSearchChange}
            disabled={disabled}
            className="pl-8"
            aria-label={t("timelineFilters.searchIdentityTimelineEvents")}
          />
        </div>

        <div className={cn(disabled && "pointer-events-none opacity-60")}>
          <ActivityTimeRange
            preset={preset}
            customRange={customRange}
            onPresetChange={handlePresetChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
      </div>

      {/* Secondary row: dropdown facets */}
      <div className="flex flex-wrap items-center gap-2">
        <ListFilterIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />

        <FilterDropdown
          label={t("timelineFilters.category")}
          heading={t("timelineFilters.filterByCategory")}
          count={filters.category.length}
          disabled={disabled}
        >
          {CATEGORIES.map((value) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={filters.category.includes(value)}
              onCheckedChange={() => toggleCategory(value)}
            >
              {t(`category.${value}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label={t("timelineFilters.severity")}
          heading={t("timelineFilters.filterBySeverity")}
          count={filters.severity.length}
          disabled={disabled}
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={filters.severity.includes(opt.value)}
              onCheckedChange={() => toggleSeverity(opt.value)}
            >
              <span
                className={cn("mr-2 inline-block size-2 rounded-full", opt.dot)}
                aria-hidden="true"
              />
              {t(`activity:severity.${opt.value}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterDropdown>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("timelineFilters.clearAllTimelineFilters")}
          >
            <XIcon className="size-3" aria-hidden="true" />
            {t("timelineFilters.clearAll")}
          </button>
        )}
      </div>

      {/* Active-filter chips */}
      {hasActiveFilters && (
        <ul
          className="flex flex-wrap items-center gap-1.5"
          aria-label={t("timelineFilters.activeFilters")}
        >
          {filters.category.map((value) => (
            <li key={`cat-${value}`}>
              <ActiveChip
                label={t("timelineFilters.categoryChip", {
                  label: (CATEGORIES as readonly string[]).includes(value)
                    ? t(`category.${value}`)
                    : value,
                })}
                onRemove={() => toggleCategory(value)}
              />
            </li>
          ))}
          {filters.severity.map((value) => (
            <li key={`sev-${value}`}>
              <ActiveChip
                label={t("timelineFilters.severityChip", {
                  label: t(`activity:severity.${value}`),
                })}
                onRemove={() => toggleSeverity(value)}
              />
            </li>
          ))}
          {filters.q && (
            <li>
              <ActiveChip label={`“${filters.q}”`} onRemove={() => setFilters({ q: "" })} />
            </li>
          )}
          {(filters.from || filters.to) && (
            <li>
              <ActiveChip label={dateChipLabel} onRemove={clearDate} />
            </li>
          )}
        </ul>
      )}
    </fieldset>
  );
}
