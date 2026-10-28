import { formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type OrgFilters,
  type OrgReading,
  type OrgRow,
  PLANS,
  roleCounts,
  STALE_DAYS,
} from "@/modules/organizations/orgs-model";
import { useOrgLabels } from "@/modules/organizations/components/org-labels";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

/**
 * One row above the table: search, your role, plan, and data region (only when the organisations
 * are in more than one). Under it, once something narrows the list, what's applied as tags, with
 * how many organisations that leaves.
 */
export function OrgsToolbar({
  filters,
  onFiltersChange,
  rows,
  shown,
  reading,
}: {
  filters: OrgFilters;
  onFiltersChange: (next: OrgFilters) => void;
  rows: OrgRow[];
  shown: number;
  reading: OrgReading;
}) {
  const { t } = useTranslation("organizations");
  const names = useOrgLabels();
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const n = (value: number) => formatNumber(value, formatLocale());
  const set = (patch: Partial<OrgFilters>) => onFiltersChange({ ...filters, ...patch });
  const count = (test: (row: OrgRow) => boolean) => n(rows.filter(test).length);

  const plans = [
    ...PLANS.filter((p) => rows.some((r) => r.plan === p)),
    ...[...new Set(rows.map((r) => r.plan))].filter(
      (p) => !(PLANS as readonly string[]).includes(p),
    ),
  ];
  const regions = [...new Set(rows.map((r) => r.region).filter(Boolean))];

  const tags: AppliedFilter[] = [];
  if (filters.role) tags.push({ id: "role", label: t("list.filters.role"), value: filters.role });
  if (filters.plan)
    tags.push({ id: "plan", label: t("list.filters.plan"), value: names.plan(filters.plan) });
  if (filters.region)
    tags.push({
      id: "region",
      label: t("list.filters.region"),
      value: names.region(filters.region),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("list.band.needsALook"),
      value: t(`list.band.looks.${filters.look}`, { target: reading.target, days: STALE_DAYS }),
    });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("list.filters.search")}
          placeholder={t("list.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("list.filters.role")}
          className="ppl-filter"
          value={filters.role ?? ANY}
          onValueChange={(value) => set({ role: value ? String(value) : undefined })}
          items={[
            { value: ANY, label: t("list.filters.anyRole") },
            ...roleCounts(rows).map(({ role, count: c }) => ({
              value: role,
              label: `${role} · ${n(c)}`,
            })),
          ]}
        />
        <Select
          aria-label={t("list.filters.plan")}
          className="ppl-filter"
          value={filters.plan ?? ANY}
          onValueChange={(value) => set({ plan: value ? String(value) : undefined })}
          items={[
            { value: ANY, label: t("list.filters.anyPlan") },
            ...plans.map((plan) => ({
              value: plan,
              label: `${names.plan(plan)} · ${count((r) => r.plan === plan)}`,
            })),
          ]}
        />
        {regions.length > 1 ? (
          <Select
            aria-label={t("list.filters.region")}
            className="ppl-filter"
            value={filters.region ?? ANY}
            onValueChange={(value) => set({ region: value ? String(value) : undefined })}
            items={[
              { value: ANY, label: t("list.filters.anyRegion") },
              ...regions.map((region) => ({
                value: region,
                label: `${names.region(region)} · ${count((r) => r.region === region)}`,
              })),
            ]}
          />
        ) : null}
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with no tags,
          QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("list.filters.summary", { n: n(shown), total: n(rows.length) })}
        />
      ) : null}
    </div>
  );
}
