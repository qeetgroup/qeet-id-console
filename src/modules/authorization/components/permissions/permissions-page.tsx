import { KeyRoundIcon } from "@qeetrix/icons";
import { Button, Select, Table, type TableColumn, type TableSort, Text } from "@qeetrix/react";
import {
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

import { PageBreadcrumb, SplitBar } from "@/modules/dashboard";
import type { Permission } from "@/modules/authorization/api/rbac";
import { type RoleAccessView, useRoleAccess } from "@/modules/authorization/api/role-access";
import {
  holdersByPermission,
  isOwnerRole,
  isReadPermission,
  resourcesOf,
  SPREAD,
  type Spread,
  shortList,
  splitPermission,
  spreadOf,
} from "@/modules/authorization/role-model";
import { BandPlaceholder, useCount, useResourceName } from "../lists/authz-parts";
import "../lists/authz-lists.css";

const ANY = "";
// The Users band's ordinal ramp (people.css): held more widely, darker.
const SWATCH: Record<Spread, string> = {
  everyone: "today",
  most: "week",
  some: "month",
  owners: "never",
};

export type PermissionFilters = {
  q?: string;
  resource?: string;
  role?: string;
  held?: Spread;
  /** `changes`: changes most people can make (the band's look). */
  look?: "changes";
};

type Row = {
  permission: Permission;
  roles: string[];
  /** Only the owner role grants it. */
  ownerOnly: boolean;
  people?: number;
  spread?: Spread;
};

const isWideChange = (r: Row) =>
  !isReadPermission(r.permission.key) && (r.spread === "everyone" || r.spread === "most");

/**
 * Authorization › Permissions: Qeet ID's own permissions (fixed by Qeet ID: roles grant them, no
 * one adds or changes them), what each allows, which roles grant it and how many people that
 * reaches. The band says how widely they're held; each part filters the list.
 */
export function PermissionsPage({
  filters,
  onFiltersChange,
}: {
  filters: PermissionFilters;
  onFiltersChange: (next: PermissionFilters) => void;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const resourceName = useResourceName();
  const view = useRoleAccess();
  const { access, catalogue, catalogueQuery } = view;
  const [sort, setSort] = useState<TableSort | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<PermissionFilters>) => onFiltersChange({ ...filters, ...patch });

  const known = view.peopleKnown && view.groupsKnown && view.permissionsKnown;
  const everyone = view.people?.length ?? 0;
  const all: Row[] = useMemo(() => {
    const holders = holdersByPermission(access);
    return catalogue.map((permission) => ({
      permission,
      roles: access
        .filter((a) => a.permissions?.has(permission.key))
        .map((a) => a.role.name)
        .sort((a, b) => a.localeCompare(b)),
      ownerOnly: !access.some((a) => !isOwnerRole(a.role) && a.permissions?.has(permission.key)),
      people: known ? (holders.get(permission.key)?.size ?? 0) : undefined,
      spread: known
        ? spreadOf(permission.key, access, holders.get(permission.key), everyone)
        : undefined,
    }));
  }, [catalogue, access, known, everyone]);

  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (!filters.resource || splitPermission(r.permission.key).resource === filters.resource) &&
        (!filters.role || r.roles.includes(filters.role)) &&
        (!filters.held || (filters.held === "owners" ? r.ownerOnly : r.spread === filters.held)) &&
        (!filters.look || isWideChange(r)) &&
        (!q || `${r.permission.key} ${r.permission.description}`.toLowerCase().includes(q)),
    );
    const dir = sort?.direction === "descending" ? -1 : 1;
    return list.sort((a, b) =>
      sort?.column === "people"
        ? dir * ((a.people ?? 0) - (b.people ?? 0)) ||
          a.permission.key.localeCompare(b.permission.key)
        : (sort ? dir : 1) * a.permission.key.localeCompare(b.permission.key),
    );
  }, [all, filters, sort]);

  const resources = useMemo(() => resourcesOf(catalogue), [catalogue]);
  const tags = [
    ...(filters.resource
      ? [
          {
            id: "resource",
            label: t("lists.permissions.filters.resource"),
            value: resourceName(filters.resource),
          },
        ]
      : []),
    ...(filters.role
      ? [{ id: "role", label: t("lists.permissions.filters.role"), value: filters.role }]
      : []),
    ...(filters.look
      ? [
          {
            id: "look",
            label: t("lists.common.needsALook"),
            value: t("lists.permissions.band.looks.wideChanges"),
          },
        ]
      : []),
    ...(filters.held
      ? [
          {
            id: "held",
            label: t("lists.permissions.filters.spread"),
            value: t(`lists.permissions.filters.spread_${filters.held}`),
          },
        ]
      : []),
  ];
  const and = {
    and: t("lists.common.and"),
    more: (m: number) => t("lists.common.more", { n: n(m) }),
  };

  const columns: TableColumn<Row>[] = [
    {
      id: "key",
      header: t("lists.permissions.columns.permission"),
      sortable: true,
      width: 190,
      cell: (r) => <span className="authz-mono">{r.permission.key}</span>,
    },
    {
      id: "allows",
      header: t("lists.permissions.columns.allows"),
      cell: (r) => r.permission.description,
    },
    {
      id: "roles",
      header: t("lists.permissions.columns.grantedBy"),
      width: 280,
      cell: (r) => {
        if (!view.permissionsKnown) return null;
        if (r.roles.length === access.length && access.length > 1)
          return <Text>{t("lists.permissions.cells.everyRole")}</Text>;
        return (
          <span className="authz-clip" title={r.roles.join(", ")}>
            {r.ownerOnly ? t("lists.permissions.cells.ownerOnly") : shortList(r.roles, and)}
          </span>
        );
      },
    },
    ...(known
      ? [
          {
            id: "people",
            header: t("lists.permissions.columns.people"),
            numeric: true,
            sortable: true,
            sortFirst: "descending" as const,
            width: 110,
            cell: (r: Row) =>
              r.spread === "everyone" ? t("lists.common.everyone") : n(r.people ?? 0),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.permissions.title")}
        count={catalogueQuery.data ? catalogue.length : undefined}
        description={t("lists.permissions.description")}
        summary={
          catalogueQuery.isError ? undefined : catalogueQuery.data &&
            view.permissionsKnown &&
            (known || !view.peopleKnown) ? (
            <PermissionsBand all={all} view={view} known={known} />
          ) : (
            <BandPlaceholder cells={3} />
          )
        }
      />
      <PageContent>
        <div className="authz-page">
          {catalogueQuery.isError ? (
            <DataState error={catalogueQuery.error} onRetry={() => catalogueQuery.refetch()} />
          ) : (
            <Table<Row>
              label={t("lists.permissions.title")}
              rows={rows}
              rowId={(r) => r.permission.id}
              rowLabel={(r) => r.permission.key}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              loading={catalogueQuery.isLoading}
              toolbar={
                <div className="ppl-toolbar">
                  <div className="ppl-filters">
                    <SearchField
                      ref={searchRef}
                      className="ppl-search"
                      aria-label={t("lists.permissions.filters.search")}
                      placeholder={t("lists.permissions.filters.searchPlaceholder")}
                      value={text}
                      onValueChange={setText}
                      onSearch={(q) => set({ q: q.trim() || undefined })}
                    />
                    <Select
                      aria-label={t("lists.permissions.filters.resource")}
                      className="ppl-filter"
                      value={filters.resource ?? ANY}
                      onValueChange={(v) => set({ resource: v ? String(v) : undefined })}
                      items={[
                        { value: ANY, label: t("lists.permissions.filters.anyResource") },
                        ...resources.map((r) => ({ value: r.key, label: resourceName(r.key) })),
                      ]}
                    />
                    <Select
                      aria-label={t("lists.permissions.filters.role")}
                      className="ppl-filter"
                      value={filters.role ?? ANY}
                      onValueChange={(v) => set({ role: v ? String(v) : undefined })}
                      items={[
                        { value: ANY, label: t("lists.permissions.filters.anyRole") },
                        ...access.map((a) => ({
                          value: a.role.name,
                          label: `${a.role.name} · ${n(a.permissions?.size ?? 0)}`,
                        })),
                      ]}
                    />
                    {known ? (
                      <Select
                        aria-label={t("lists.permissions.filters.spread")}
                        className="ppl-filter"
                        value={filters.held ?? ANY}
                        onValueChange={(v) => set({ held: v ? (String(v) as Spread) : undefined })}
                        items={[
                          { value: ANY, label: t("lists.permissions.filters.anySpread") },
                          ...SPREAD.map((s) => ({
                            value: s,
                            label: `${t(`lists.permissions.filters.spread_${s}`)} · ${n(all.filter((r) => r.spread === s).length)}`,
                          })),
                        ]}
                      />
                    ) : null}
                  </div>
                  {tags.length || filters.q ? (
                    <FilterTags
                      filters={tags}
                      onRemove={(id) => set({ [id]: undefined })}
                      onClear={() => onFiltersChange({ q: filters.q })}
                      returnFocusTo={searchRef}
                      summary={t("lists.permissions.filters.summary", {
                        n: n(rows.length),
                        total: n(all.length),
                      })}
                    />
                  ) : null}
                </div>
              }
              empty={
                catalogue.length ? (
                  <EmptyState
                    size="section"
                    icon={KeyRoundIcon}
                    title={t("lists.common.noMatchTitle")}
                    description={t("lists.common.noMatchDescription")}
                    actions={
                      <Button variant="ghost" onClick={() => onFiltersChange({})}>
                        {t("lists.common.clearFilters")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    size="section"
                    icon={KeyRoundIcon}
                    title={t("lists.permissions.empty.title")}
                    description={t("lists.permissions.empty.description")}
                  />
                )
              }
            />
          )}
        </div>
      </PageContent>
    </>
  );
}

/**
 * The catalogue's key numbers: how many permissions and what kind, how widely they're held (with
 * people and groups known), and the two that need a look: changes most people can make, and
 * permissions only the owner role grants.
 */
function PermissionsBand({
  all,
  view,
  known,
}: {
  all: Row[];
  view: RoleAccessView;
  known: boolean;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const reads = all.filter((r) => isReadPermission(r.permission.key)).length;
  const spread = SPREAD.map((id) => ({ id, count: all.filter((r) => r.spread === id).length }));
  const to = (search: PermissionFilters) => ({ to: "/authorization/permissions" as const, search });
  const wideChanges = all.filter(isWideChange).length;
  const ownersOnly = all.filter((r) => r.ownerOnly).length;
  return (
    <dl className={known ? "ppl-band is-three" : "ppl-band authz-band-two"}>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.permissions.band.permissions")}</dt>
        <dd className="ppl-value">{n(all.length)}</dd>
        <dd className="ppl-note">
          {t("lists.permissions.band.note", {
            read: n(reads),
            change: n(all.length - reads),
            resources: n(resourcesOf(view.catalogue).length),
          })}
        </dd>
      </div>
      {known ? (
        <div className="ppl-cell">
          <dt className="ppl-label">{t("lists.permissions.band.spread")}</dt>
          <dd className="ppl-recency">
            <SplitBar
              label={spread
                .map((s) => `${n(s.count)} ${t(`lists.permissions.band.spreadLegend.${s.id}`)}`)
                .join(", ")}
              parts={spread.map((s) => ({ value: s.count, color: `var(--ppl-${SWATCH[s.id]})` }))}
            />
          </dd>
          <dd className="ppl-recency-legend">
            <ul>
              {spread.map((s) => (
                <li key={s.id} className={s.count ? undefined : "is-zero"}>
                  <Link {...to({ held: s.id })}>
                    <span className={`ppl-swatch is-${SWATCH[s.id]}`} aria-hidden="true" />
                    <b>{n(s.count)}</b> {t(`lists.permissions.band.spreadLegend.${s.id}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.common.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            {known ? (
              <li className={wideChanges ? undefined : "is-zero"}>
                <Link {...to({ look: "changes" })}>
                  <span>{t("lists.permissions.band.looks.wideChanges")}</span>
                  <b className={wideChanges ? "is-warning" : undefined}>{n(wideChanges)}</b>
                </Link>
              </li>
            ) : null}
            <li className={ownersOnly ? undefined : "is-zero"}>
              <Link {...to({ held: "owners" })}>
                <span>{t("lists.permissions.band.looks.ownersOnly")}</span>
                <b>{n(ownersOnly)}</b>
              </Link>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  );
}
