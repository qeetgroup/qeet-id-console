import { ArrowDownAlt, CloseCircle, SearchNormal, Sort } from "@qeetrix/icons";
// Timeline filter bar — a compact, dropdown-driven control surface.
// Primary row: full-text search + time-range preset. Secondary row: Category
// and Severity multi-select dropdowns. Active selections render as removable
// chips so the applied filter set is always legible without reopening menus.
// Capability-aware: requires audit.read + user.read to be interactive.

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
import { useCallback, useState } from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { ActivityTimeRange, type DateRange, presetToRange, TIME_PRESETS } from "@/modules/activity";
import type { Severity } from "@/modules/activity";
import { useTimeline } from "../timeline-provider";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: "authentication", label: "Authentication" },
  { value: "authorization", label: "Authorization" },
  { value: "security", label: "Security" },
  { value: "provisioning", label: "Provisioning" },
  { value: "organizations", label: "Organizations" },
  { value: "groups", label: "Groups" },
  { value: "policies", label: "Policies" },
  { value: "applications", label: "Applications" },
  { value: "devices", label: "Devices" },
  { value: "sessions", label: "Sessions" },
  { value: "api", label: "API" },
  { value: "administration", label: "Administration" },
] as const;

const SEVERITY_OPTIONS: { value: Severity; label: string; dot: string }[] = [
  { value: "info", label: "Info", dot: "bg-info" },
  { value: "success", label: "Success", dot: "bg-success" },
  { value: "warning", label: "Warning", dot: "bg-warning" },
  { value: "error", label: "Error", dot: "bg-destructive" },
  { value: "critical", label: "Critical", dot: "bg-destructive" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);
const PRESET_LABEL: Record<string, string> = Object.fromEntries(
  TIME_PRESETS.map((p) => [p.value, p.label]),
);

// ---------------------------------------------------------------------------
// Dropdown + chip primitives
// ---------------------------------------------------------------------------

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
            <ArrowDownAlt className="size-3.5 opacity-60" aria-hidden="true" />
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
      <CloseCircle className="size-3 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// TimelineFilters
// ---------------------------------------------------------------------------

export function TimelineFilters() {
  const access = useCapabilities();
  const disabled = !access.can("audit.read") || !access.can("user.read");

  const { filters, setFilters, resetFilters } = useTimeline();

  // Local UI state for the time-range control; the resolved { from, to } window
  // lives in the shared filter store.
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

  const dateChipLabel =
    preset !== "all" && preset !== "custom"
      ? PRESET_LABEL[preset]
      : preset === "custom"
        ? "Custom range"
        : "Date range";

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" aria-label="Timeline filters">
      {/* Primary row: search + time range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <SearchNormal
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search events, users, IPs, event IDs…"
            value={filters.q}
            onChange={handleSearchChange}
            disabled={disabled}
            className="pl-8"
            aria-label="Search identity timeline events"
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
        <Sort className="size-3.5 text-muted-foreground" aria-hidden="true" />

        <FilterDropdown
          label="Category"
          heading="Filter by category"
          count={filters.category.length}
          disabled={disabled}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={filters.category.includes(opt.value)}
              onCheckedChange={() => toggleCategory(opt.value)}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          label="Severity"
          heading="Filter by severity"
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
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </FilterDropdown>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Clear all timeline filters"
          >
            <CloseCircle className="size-3" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>

      {/* Active-filter chips */}
      {hasActiveFilters && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {filters.category.map((value) => (
            <li key={`cat-${value}`}>
              <ActiveChip
                label={`Category: ${CATEGORY_LABEL[value] ?? value}`}
                onRemove={() => toggleCategory(value)}
              />
            </li>
          ))}
          {filters.severity.map((value) => (
            <li key={`sev-${value}`}>
              <ActiveChip
                label={`Severity: ${SEVERITY_LABEL[value] ?? value}`}
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
