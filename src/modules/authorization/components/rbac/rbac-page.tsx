import { CheckIcon, KeyRoundIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { Button, Select, Table, type TableColumn, VisuallyHidden } from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import type { Permission } from "@/modules/authorization/api/rbac";
import { useRoleAccess } from "@/modules/authorization/api/role-access";
import { resourcesOf, splitPermission } from "@/modules/authorization/role-model";
import { Two, useCount, useResourceName } from "../lists/authz-parts";
import { RoleDrawer } from "../roles/role-drawer";
import "../lists/authz-lists.css";

const ANY = "";

export type RbacFilters = { q?: string; resource?: string };

export type RbacPageProps = {
  filters: RbacFilters;
  onFiltersChange: (next: RbacFilters) => void;
  /** The role whose drawer is open (`?role=<id>`). */
  roleId?: string;
  onRoleChange: (roleId: string | undefined) => void;
};

/**
 * Models › RBAC: every role's permissions side by side, widest first, so roles read as a staircase
 * and an odd grant stands out. A role's name opens the same drawer as on Roles, where it changes.
 */
export function RbacPage({ filters, onFiltersChange, roleId, onRoleChange }: RbacPageProps) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const resourceName = useResourceName();
  const view = useRoleAccess();
  const { access, catalogue, rolesQuery, catalogueQuery } = view;
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<RbacFilters>) => onFiltersChange({ ...filters, ...patch });

  // Widest first, then by name: the owner role at the start, the narrowest at the end.
  const columnsFor = useMemo(
    () =>
      [...access].sort(
        (a, b) =>
          (b.permissions?.size ?? 0) - (a.permissions?.size ?? 0) ||
          a.role.name.localeCompare(b.role.name),
      ),
    [access],
  );
  const resources = useMemo(() => resourcesOf(catalogue), [catalogue]);
  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    return [...catalogue]
      .filter((p) => !filters.resource || splitPermission(p.key).resource === filters.resource)
      .filter((p) => !q || `${p.key} ${p.description}`.toLowerCase().includes(q))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [catalogue, filters.q, filters.resource]);

  const columns: TableColumn<Permission>[] = [
    {
      id: "permission",
      header: t("lists.rbac.permission"),
      width: 260,
      cell: (p) => <Two main={<span className="authz-mono">{p.key}</span>} sub={p.description} />,
    },
    ...columnsFor.map(
      (a): TableColumn<Permission> => ({
        id: a.role.id,
        align: "center",
        header: (
          <Link
            to="/authorization/rbac"
            search={{ ...filters, role: a.role.id }}
            className="authz-col-role"
          >
            <span>{a.role.name}</span>
            {view.peopleKnown ? (
              <small>
                {a.holders.size
                  ? t("lists.common.people", { count: a.holders.size, n: n(a.holders.size) })
                  : t("lists.common.noOne")}
              </small>
            ) : null}
          </Link>
        ),
        cell: (p) =>
          a.permissions?.has(p.key) ? (
            <span className="authz-yes">
              <CheckIcon shape="sharp" size={16} aria-hidden="true" />
              <VisuallyHidden>{t("lists.rbac.granted")}</VisuallyHidden>
            </span>
          ) : (
            <VisuallyHidden>{t("lists.rbac.notGranted")}</VisuallyHidden>
          ),
      }),
    ),
  ];

  const error = rolesQuery.error ?? catalogueQuery.error;
  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.rbac.title")}
        description={t("lists.rbac.description")}
        tabs={<PageTabList />}
      />
      <PageContent>
        <div className="authz-page">
          {error ? (
            <DataState
              error={error}
              onRetry={() => {
                void rolesQuery.refetch();
                void catalogueQuery.refetch();
              }}
            />
          ) : rolesQuery.data && access.length === 0 ? (
            <EmptyState
              size="section"
              icon={ShieldCheckIcon}
              title={t("lists.rbac.empty.title")}
              description={t("lists.rbac.empty.description")}
              actions={
                <Button variant="soft" render={<Link to="/authorization/roles" />}>
                  {t("lists.roles.title")}
                </Button>
              }
            />
          ) : (
            <Table<Permission>
              label={t("lists.rbac.tableLabel")}
              className="authz-matrix"
              rows={rows}
              rowId={(p) => p.id}
              rowLabel={(p) => p.key}
              columns={columns}
              loading={rolesQuery.isLoading || catalogueQuery.isLoading}
              toolbar={
                <div className="ppl-toolbar">
                  <div className="ppl-filters">
                    <SearchField
                      className="ppl-search"
                      aria-label={t("lists.rbac.filters.search")}
                      placeholder={t("lists.rbac.filters.searchPlaceholder")}
                      value={text}
                      onValueChange={setText}
                      onSearch={(q) => set({ q: q.trim() || undefined })}
                    />
                    <Select
                      aria-label={t("lists.rbac.filters.resource")}
                      className="ppl-filter"
                      value={filters.resource ?? ANY}
                      onValueChange={(v) => set({ resource: v ? String(v) : undefined })}
                      items={[
                        { value: ANY, label: t("lists.rbac.filters.anyResource") },
                        ...resources.map((r) => ({ value: r.key, label: resourceName(r.key) })),
                      ]}
                    />
                  </div>
                </div>
              }
              empty={
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
              }
            />
          )}
        </div>
      </PageContent>
      <RoleDrawer roleId={roleId ?? null} view={view} onClose={() => onRoleChange(undefined)} />
    </PageTabs>
  );
}
