import { formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { ACCESS, type Access, type GrantFilters, type GrantRow } from "./grants-model";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

/** Search, then the application and access filters, in one row; what's applied under them. */
export function GrantsToolbar({
  filters,
  onFiltersChange,
  rows,
  shown,
}: {
  filters: GrantFilters;
  onFiltersChange: (next: GrantFilters) => void;
  rows: GrantRow[];
  shown: number;
}) {
  const { t } = useTranslation("consent");
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const set = (patch: Partial<GrantFilters>) => onFiltersChange({ ...filters, ...patch });

  const apps = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const app = apps.get(row.client_id);
    apps.set(row.client_id, { name: row.app, count: (app?.count ?? 0) + 1 });
  }
  const appName = filters.app ? (apps.get(filters.app)?.name ?? filters.app) : "";
  const accessCount = (a: Access) => rows.filter((row) => row.scopes.includes(a)).length;

  const tags: AppliedFilter[] = [];
  if (filters.app) tags.push({ id: "app", label: t("columns.application"), value: appName });
  if (filters.access)
    tags.push({ id: "access", label: t("columns.access"), value: t(`access.${filters.access}`) });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("columns.application")}
          className="ppl-filter"
          value={filters.app ?? ANY}
          onValueChange={(value) => set({ app: value ? String(value) : undefined })}
          items={[
            { value: ANY, label: t("filters.anyApp") },
            ...[...apps.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([id, app]) => ({ value: id, label: `${app.name} · ${n(app.count)}` })),
          ]}
        />
        <Select
          aria-label={t("columns.access")}
          className="ppl-filter"
          value={filters.access ?? ANY}
          onValueChange={(value) => set({ access: value ? (String(value) as Access) : undefined })}
          items={[
            { value: ANY, label: t("filters.anyAccess") },
            ...ACCESS.map((a) => ({
              value: a,
              label: `${t(`access.${a}`)} · ${n(accessCount(a))}`,
            })),
          ]}
        />
      </div>
      {/* Only once something narrows the list: FilterTags shows its summary even with no tags
          (QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => onFiltersChange({ ...filters, [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("filters.summary", { n: n(shown), total: n(rows.length) })}
        />
      ) : null}
    </div>
  );
}
