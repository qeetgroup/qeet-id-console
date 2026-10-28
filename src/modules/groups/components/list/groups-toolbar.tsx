import { ChevronsDownUpIcon, ChevronsUpDownIcon } from "@qeetrix/icons";
import { Button, formatNumber, Select } from "@qeetrix/react";
import { type AppliedFilter, FilterTags, SearchField } from "@qeetrix/react/experimental";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type GroupFilters,
  type GroupNode,
  isFlat,
  type RolesByGroup,
  SIZES,
  sizeOf,
} from "@/modules/groups/groups-model";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).

/**
 * One row above the table: search, size, roles granted and the group to look inside, then Expand
 * or Collapse all at its end. Under it, once something narrows the list, what's applied as tags,
 * with how many groups that leaves. The roles filter waits until every group's roles are in.
 */
export function GroupsToolbar({
  filters,
  onFiltersChange,
  all,
  roles,
  shown,
  allOpen,
  onFoldAll,
}: {
  filters: GroupFilters;
  onFiltersChange: (next: GroupFilters) => void;
  all: GroupNode[];
  roles?: RolesByGroup;
  shown: number;
  allOpen: boolean;
  onFoldAll: () => void;
}) {
  const { t } = useTranslation("groups");
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const set = (patch: Partial<GroupFilters>) => onFiltersChange({ ...filters, ...patch });
  const flat = isFlat(filters);

  const granted = (g: GroupNode) => roles?.get(g.id) ?? [];
  const roleCounts = new Map<string, number>();
  for (const name of roles ? all.flatMap(granted) : [])
    roleCounts.set(name, (roleCounts.get(name) ?? 0) + 1);
  const roleNames = [...roleCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const parents = all.filter((g) => g.children.length);
  const parentLabel = (g: GroupNode) => [...g.path, g.name].join(" › ");
  const rolesValue = filters.role ? `role:${filters.role}` : (filters.grants ?? ANY);

  const tags: AppliedFilter[] = [];
  if (filters.size)
    tags.push({
      id: "size",
      label: t("list.filters.size"),
      value: t(`list.sizes.${filters.size}`),
    });
  if (filters.grants)
    tags.push({
      id: "grants",
      label: t("list.filters.roles"),
      value: t(filters.grants === "some" ? "list.filters.grantsSome" : "list.filters.grantsNone"),
    });
  if (filters.role) tags.push({ id: "role", label: t("list.filters.roles"), value: filters.role });
  if (filters.inside) {
    const inside = all.find((g) => g.id === filters.inside);
    if (inside)
      tags.push({ id: "inside", label: t("list.filters.inside"), value: parentLabel(inside) });
  }
  if (filters.look)
    tags.push({
      id: "look",
      label: t("list.band.needsALook"),
      value: t(`list.band.looks.${filters.look}`),
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
          aria-label={t("list.filters.size")}
          className="ppl-filter"
          value={filters.size ?? ANY}
          onValueChange={(value) =>
            set({ size: value ? (String(value) as GroupFilters["size"]) : undefined })
          }
          items={[
            { value: ANY, label: t("list.filters.anySize") },
            ...SIZES.map((id) => ({
              value: id,
              label: `${t(`list.sizes.${id}`)} · ${n(all.filter((g) => sizeOf(g.people) === id).length)}`,
            })),
          ]}
        />
        {roles ? (
          <Select
            aria-label={t("list.filters.roles")}
            className="ppl-filter"
            value={rolesValue}
            onValueChange={(value) => {
              const v = String(value ?? "");
              set(
                v.startsWith("role:")
                  ? { role: v.slice(5), grants: undefined }
                  : { role: undefined, grants: v ? (v as "some" | "none") : undefined },
              );
            }}
            items={[
              { value: ANY, label: t("list.filters.anyRoles") },
              {
                value: "some",
                label: `${t("list.filters.grantsSome")} · ${n(all.filter((g) => granted(g).length).length)}`,
              },
              {
                value: "none",
                label: `${t("list.filters.grantsNone")} · ${n(all.filter((g) => !granted(g).length).length)}`,
              },
              ...roleNames.map(([name, count]) => ({
                value: `role:${name}`,
                label: `${name} · ${n(count)}`,
              })),
            ]}
          />
        ) : null}
        {parents.length ? (
          <Select
            aria-label={t("list.filters.inside")}
            className="ppl-filter"
            value={filters.inside ?? ANY}
            onValueChange={(value) => set({ inside: value ? String(value) : undefined })}
            items={[
              { value: ANY, label: t("list.filters.anywhere") },
              ...parents.map((g) => ({ value: g.id, label: `${parentLabel(g)} · ${n(g.inside)}` })),
            ]}
          />
        ) : null}
        {parents.length ? (
          <span className="grp-fold">
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              icon={allOpen ? ChevronsDownUpIcon : ChevronsUpDownIcon}
              disabled={flat}
              onClick={onFoldAll}
            >
              {allOpen ? t("list.filters.collapseAll") : t("list.filters.expandAll")}
            </Button>
          </span>
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
          summary={t("list.filters.summary", { n: n(shown), total: n(all.length) })}
        />
      ) : null}
    </div>
  );
}
