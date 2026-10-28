import { BoxesIcon } from "@qeetrix/icons";
import { Button, Drawer, Select, Table, type TableColumn, type TableSort } from "@qeetrix/react";
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

import { type AbacPolicy, useAbacPolicies } from "@/modules/authorization/api/abac";
import { useRoleAccess } from "@/modules/authorization/api/role-access";
import { resourcesOf, shortList } from "@/modules/authorization/role-model";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import { BandPlaceholder, NoneCell, ResourceName, useCount } from "../lists/authz-parts";
import {
  guardOf,
  isOpenAllow,
  type ResourceFilters,
  type ResourceRow as Row,
} from "./resources-model";
import { PolicyLines, ResourceDrawerContent, ResourcesBand } from "./resources-parts";
import "../lists/authz-lists.css";

const ANY = "";
const NO_POLICIES: AbacPolicy[] = [];

/**
 * Authorization › Resources: what protects each resource, across the models. Qeet ID's own come
 * from its permission keys (the roles that grant actions on them); the rest are the resource types
 * only your ABAC policies name. A policy on every resource ("*") is said once, above the list. A
 * row opens who can act on it and its policies.
 */
export function ResourcesPage({
  filters,
  onFiltersChange,
  open,
  onOpenChange,
}: {
  filters: ResourceFilters;
  onFiltersChange: (next: ResourceFilters) => void;
  /** The resource whose drawer is open (`?resource=<key>`). */
  open?: string;
  onOpenChange: (key: string | undefined) => void;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const canPolicies = useCapabilities().can("policy.read");
  const view = useRoleAccess();
  const { catalogue, catalogueQuery, access } = view;
  const policiesQ = useAbacPolicies(canPolicies);
  const policies = policiesQ.data?.items ?? NO_POLICIES;
  const [sort, setSort] = useState<TableSort | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<ResourceFilters>) => onFiltersChange({ ...filters, ...patch });

  const everywhere = useMemo(
    () => policies.filter((p) => p.resource_type === "*").sort((a, b) => b.priority - a.priority),
    [policies],
  );
  const all: Row[] = useMemo(() => {
    const own = resourcesOf(catalogue).map(
      (r): Row => ({
        key: r.key,
        source: "qeet",
        permissions: [...r.actions.values()],
        actions: [...r.actions.keys()],
        roles: access.filter((a) => [...r.actions.values()].some((p) => a.permissions?.has(p.key)))
          .length,
        policies: policies.filter((p) => p.resource_type === r.key),
      }),
    );
    const named = [...new Set(policies.map((p) => p.resource_type))]
      .filter((type) => type !== "*" && !own.some((r) => r.key === type))
      .sort((a, b) => a.localeCompare(b))
      .map((type): Row => {
        const list = policies.filter((p) => p.resource_type === type);
        return {
          key: type,
          source: "policy",
          permissions: [],
          actions: [...new Set(list.map((p) => p.action))],
          roles: 0,
          policies: list,
        };
      });
    return [...own, ...named];
  }, [catalogue, access, policies]);

  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (!filters.by || r.source === filters.by) &&
        (!filters.guard || guardOf(r) === filters.guard) &&
        (filters.look !== "off" || r.policies.some((p) => !p.enabled)) &&
        (filters.look !== "open" || r.policies.some(isOpenAllow)) &&
        (!q || `${r.key} ${r.policies.map((p) => p.name).join(" ")}`.toLowerCase().includes(q)),
    );
    const dir = sort?.direction === "descending" ? -1 : 1;
    return sort?.column === "key" ? list.sort((a, b) => dir * a.key.localeCompare(b.key)) : list;
  }, [all, filters, sort]);

  const tags = [
    ...(filters.by
      ? [
          {
            id: "by",
            label: t("lists.resources.filters.by"),
            value: t(
              filters.by === "qeet"
                ? "lists.resources.filters.qeet"
                : "lists.resources.filters.policy",
            ),
          },
        ]
      : []),
    ...(filters.guard
      ? [
          {
            id: "guard",
            label: t("lists.resources.band.guarded"),
            value: t(`lists.resources.band.guardedLegend.${filters.guard}`),
          },
        ]
      : []),
    ...(filters.look
      ? [
          {
            id: "look",
            label: t("lists.common.needsALook"),
            value: t(`lists.resources.band.looks.${filters.look}`),
          },
        ]
      : []),
  ];

  const columns: TableColumn<Row>[] = [
    {
      id: "key",
      header: t("lists.resources.columns.resource"),
      primary: true,
      sortable: true,
      width: 220,
      cell: (r) => <ResourceName resource={r.key} />,
    },
    {
      id: "actions",
      header: t("lists.resources.columns.actions"),
      width: 150,
      cell: (r) => (
        <span className="authz-mono">
          {r.actions.map((a) => (a === "*" ? t("lists.resources.cells.all") : a)).join(" · ")}
        </span>
      ),
    },
    {
      id: "roles",
      header: t("lists.resources.columns.roles"),
      numeric: true,
      width: 90,
      cell: (r) => (r.roles ? n(r.roles) : <NoneCell />),
    },
    ...(canPolicies
      ? [
          {
            id: "policies",
            header: t("lists.resources.columns.policies"),
            cell: (r: Row) => <PolicyLines policies={r.policies} />,
          },
        ]
      : []),
    {
      id: "source",
      header: t("lists.resources.columns.definedBy"),
      width: 140,
      cell: (r) =>
        t(r.source === "qeet" ? "lists.resources.cells.qeet" : "lists.resources.cells.yours"),
    },
  ];

  const openRow = open ? all.find((r) => r.key === open) : undefined;
  const loading = catalogueQuery.isLoading || (canPolicies && policiesQ.isLoading);
  const error = catalogueQuery.error ?? policiesQ.error;
  const and = {
    and: t("lists.common.and"),
    more: (m: number) => t("lists.common.more", { n: n(m) }),
  };

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.resources.title")}
        count={loading ? undefined : all.length}
        description={
          everywhere.length
            ? `${t("lists.resources.description")} ${t("lists.resources.everyResource", {
                count: everywhere.length,
                names: shortList(
                  everywhere.map((p) => p.name),
                  and,
                ),
              })}`
            : t("lists.resources.description")
        }
        summary={
          error ? undefined : loading || !view.permissionsKnown ? (
            <BandPlaceholder cells={3} />
          ) : (
            <ResourcesBand all={all} policies={policies} canPolicies={canPolicies} />
          )
        }
      />
      <PageContent>
        <div className="authz-page">
          {error ? (
            <DataState
              error={error}
              onRetry={() => {
                void catalogueQuery.refetch();
                void policiesQ.refetch();
              }}
            />
          ) : (
            <Table<Row>
              label={t("lists.resources.title")}
              rows={rows}
              rowId={(r) => `${r.source}:${r.key}`}
              rowLabel={(r) => r.key}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              loading={loading}
              renderRowLink={(r) => (
                <Link to="/authorization/resources" search={{ ...filters, resource: r.key }} />
              )}
              toolbar={
                <div className="ppl-toolbar">
                  <div className="ppl-filters">
                    <SearchField
                      ref={searchRef}
                      className="ppl-search"
                      aria-label={t("lists.resources.filters.search")}
                      placeholder={t("lists.resources.filters.searchPlaceholder")}
                      value={text}
                      onValueChange={setText}
                      onSearch={(q) => set({ q: q.trim() || undefined })}
                    />
                    {canPolicies ? (
                      <Select
                        aria-label={t("lists.resources.filters.by")}
                        className="ppl-filter"
                        value={filters.by ?? ANY}
                        onValueChange={(v) =>
                          set({ by: v ? (String(v) as ResourceFilters["by"]) : undefined })
                        }
                        items={[
                          { value: ANY, label: t("lists.resources.filters.anyBy") },
                          {
                            value: "qeet",
                            label: `${t("lists.resources.filters.qeet")} · ${n(all.filter((r) => r.source === "qeet").length)}`,
                          },
                          {
                            value: "policy",
                            label: `${t("lists.resources.filters.policy")} · ${n(all.filter((r) => r.source === "policy").length)}`,
                          },
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
                      summary={t("lists.resources.filters.summary", {
                        n: n(rows.length),
                        total: n(all.length),
                      })}
                    />
                  ) : null}
                </div>
              }
              empty={
                all.length ? (
                  <EmptyState
                    size="section"
                    icon={BoxesIcon}
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
                    icon={BoxesIcon}
                    title={t("lists.resources.empty.title")}
                    description={t("lists.resources.empty.description")}
                  />
                )
              }
            />
          )}
        </div>
      </PageContent>
      <Drawer open={!!openRow} onOpenChange={(o) => !o && onOpenChange(undefined)}>
        {openRow ? (
          <ResourceDrawerContent
            row={openRow}
            view={view}
            everywhere={everywhere}
            canPolicies={canPolicies}
          />
        ) : null}
      </Drawer>
    </>
  );
}
