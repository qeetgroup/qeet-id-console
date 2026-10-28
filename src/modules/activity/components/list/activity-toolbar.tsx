import { formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useStore } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import i18n, { formatLocale } from "@/i18n";
import {
  type ActivitySearch,
  rangeOf,
  severityList,
  tabOf,
} from "@/modules/activity/activity-search";
import {
  ACTIVITY_CATEGORIES,
  categoryLabel,
  formatEventTitle,
  resourceLabel,
  severityLabel,
} from "@/modules/activity/event-labels";
import { PRESET_VIEWS, type SavedView, savedViewsStore } from "@/modules/activity/saved-views";
import {
  ACTIVITY_RANGES,
  DEFAULT_ACTIVITY_RANGE,
  dayOf,
  rangeToWindow,
  windowToRange,
} from "@/modules/activity/time-range";
import type {
  ActivityEvent,
  ActivityFilters,
  ActivitySummary,
} from "@/modules/activity/types/activity.types";
import { ActivityTimeRange } from "../activity-time-range";
import { ActivitySavedViews } from "./activity-saved-views";

const ANY = "";
// The tags a person can remove, each one URL param.
type TagId = "actor" | "type" | "ip" | "resource" | "severity" | "category";

/**
 * One row above the table: search, the time range (with its dates once it's custom), the
 * category, and the saved views at the end. Under it, once something narrows the list, what's
 * applied as tags, and how many events that leaves when the server's counts can say.
 */
export function ActivityToolbar({
  search,
  filters,
  summary,
  events,
  total,
  onChange,
  onApplyView,
}: {
  search: ActivitySearch;
  filters: ActivityFilters;
  summary: ActivitySummary | undefined;
  /** The events loaded, to name an actor the address only has the ID of. */
  events: readonly ActivityEvent[];
  /** How many events the filters leave, when known. */
  total: number | undefined;
  onChange: (patch: Partial<ActivitySearch>) => void;
  onApplyView: (view: SavedView) => void;
}) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(search.q ?? "");
  useEffect(() => setText(search.q ?? ""), [search.q]);
  const mine = useStore(savedViewsStore, (s) => s.views);

  const range = rangeOf(search);
  const onPresetChange = (preset: string) => {
    if (preset === "custom") {
      // Start from the days the list covers now, up to today.
      const from = filters.from || new Date(Date.now() - 86_400_000).toISOString();
      const days = { start: dayOf(new Date(from)), end: dayOf(new Date()) };
      onChange({ range: "custom", ...rangeToWindow(days) });
      return;
    }
    const known = (ACTIVITY_RANGES as readonly string[]).includes(preset);
    onChange({
      range:
        known && preset !== DEFAULT_ACTIVITY_RANGE
          ? (preset as ActivitySearch["range"])
          : undefined,
      from: undefined,
      to: undefined,
    });
  };

  const actorName =
    search.actor &&
    (events.find((e) => e.actor?.id === search.actor && e.actor?.name)?.actor?.name ??
      search.actor.slice(0, 8));
  const types = search.type?.split(",").filter(Boolean) ?? [];
  const preset = PRESET_VIEWS.find((v) => v.id === search.view);
  const own = mine.find((v) => v.id === search.view);
  const view = preset ?? own;
  const viewName = preset ? i18n.t(preset.name) : own?.name;
  const severities = severityList(search.severity);

  const tags: (AppliedFilter & { id: TagId })[] = [];
  if (search.actor && actorName)
    tags.push({ id: "actor", label: t("toolbar.tags.actor"), value: actorName });
  if (types.length)
    tags.push({
      id: "type",
      label: t("toolbar.tags.type"),
      value:
        view && view.search.type === search.type && viewName
          ? viewName
          : types.length === 1
            ? formatEventTitle({ type: types[0] ?? "" })
            : t("toolbar.kinds", { count: types.length, n: n(types.length) }),
    });
  if (search.ip) tags.push({ id: "ip", label: t("toolbar.tags.ip"), value: search.ip });
  if (search.resource)
    tags.push({
      id: "resource",
      label: t("toolbar.tags.resource"),
      value: resourceLabel(search.resource),
    });
  // Failed and Critical are tabs; any other outcome is a tag.
  if (severities.length && tabOf(search.severity) === "all")
    tags.push({
      id: "severity",
      label: t("toolbar.tags.severity"),
      value: severities.map(severityLabel).join(", "),
    });
  if (search.category)
    tags.push({
      id: "category",
      label: t("toolbar.tags.category"),
      value: search.category.split(",").map(categoryLabel).join(", "),
    });

  const byCategory = summary?.by_category;
  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("toolbar.search")}
          placeholder={t("toolbar.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => onChange({ q: q.trim() || undefined })}
        />
        <ActivityTimeRange
          className="act-range"
          selectClassName="ppl-filter"
          pickerClassName="act-dates"
          presets={ACTIVITY_RANGES}
          preset={range}
          customRange={range === "custom" ? windowToRange(filters.from, filters.to) : undefined}
          onPresetChange={onPresetChange}
          // A half-typed range isn't one: keep the last, until the dates read as a range.
          onCustomRangeChange={(days) =>
            days && onChange({ range: "custom", ...rangeToWindow(days) })
          }
        />
        <Select
          aria-label={t("toolbar.category")}
          className="ppl-filter"
          value={filters.category.length === 1 ? (filters.category[0] ?? ANY) : ANY}
          onValueChange={(value) => onChange({ category: value ? String(value) : undefined })}
          items={[
            { value: ANY, label: t("toolbar.anyCategory") },
            // Each count is part of its label until Select items have one of their own (QTRX-20).
            ...ACTIVITY_CATEGORIES.map((value) => ({
              value,
              label: byCategory
                ? `${categoryLabel(value)} · ${n(byCategory[value] ?? 0)}`
                : categoryLabel(value),
            })),
          ]}
        />
        <span className="act-toolbar-end">
          <ActivitySavedViews search={search} onApply={onApplyView} />
        </span>
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with no tags,
          QTRX-15). */}
      {tags.length || search.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => onChange({ [id as TagId]: undefined, view: undefined })}
          onClear={() =>
            onChange({
              actor: undefined,
              type: undefined,
              ip: undefined,
              resource: undefined,
              severity: tabOf(search.severity) === "all" ? undefined : search.severity,
              category: undefined,
              view: undefined,
            })
          }
          returnFocusTo={searchRef}
          summary={
            total !== undefined ? t("toolbar.summary", { count: total, n: n(total) }) : undefined
          }
        />
      ) : null}
    </div>
  );
}
