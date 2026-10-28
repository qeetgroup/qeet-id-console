import {
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Table,
  type TableColumn,
  type TableSort,
  Text,
} from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import type { Role } from "@/modules/authorization/api/rbac";
import { useRoleAccess } from "@/modules/authorization/api/role-access";
import type { RoleAccess } from "@/modules/authorization/role-model";
import { BandPlaceholder, NoneCell, Two, useCount } from "../lists/authz-parts";
import { NewRoleDrawer } from "./new-role-drawer";
import { RoleDrawer } from "./role-drawer";
import { RolesBand } from "./roles-band";
import { matchesRole, ROLE_TYPES, type RoleFilters, sortRoles } from "./roles-model";
import "../lists/authz-lists.css";

const PAGE_SIZE = 25;
const ANY = "";

const roleCsvColumns: CsvColumn<Role>[] = [
  { header: "id", value: (r) => r.id },
  { header: "name", value: (r) => r.name },
  { header: "description", value: (r) => r.description },
  { header: "type", value: (r) => (r.is_system ? "built_in" : "custom") },
  { header: "created_at", value: (r) => r.created_at },
];

export type RolesPageProps = {
  /** The filters and search in the page address. */
  filters: RoleFilters;
  onFiltersChange: (next: RoleFilters) => void;
  /** The role whose drawer is open (`?role=<id>`). */
  roleId?: string;
  onRoleChange: (roleId: string | undefined) => void;
};

/**
 * Authorization › Roles: each role, who holds it and how much it grants. The key numbers sit in
 * the header, each look a filter; search and filters are one row over the table, in the address. A
 * row opens the role's drawer, the one Models › RBAC opens too: who holds it, and its permissions.
 */
export function RolesPage({ filters, onFiltersChange, roleId, onRoleChange }: RolesPageProps) {
  const { t } = useTranslation(["authorization", "common"]);
  const n = useCount();
  const caps = useCapabilities();
  const canWrite = caps.can("role.write");
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);
  const view = useRoleAccess();
  const { roles, access, catalogue, rolesQuery } = view;
  const [creating, setCreating] = useCreateIntent(canWrite);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [offset, setOffset] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const set = (patch: Partial<RoleFilters>) => {
    setOffset(0);
    onFiltersChange({ ...filters, ...patch });
  };
  const rows = useMemo(
    () =>
      sortRoles(
        access.filter((a) => matchesRole(a, filters, catalogue.length)),
        sort,
      ),
    [access, filters, catalogue.length, sort],
  );
  const start = offset < rows.length ? offset : 0;
  const onPage = rows.slice(start, start + PAGE_SIZE);
  const filtered = !!(filters.q || filters.type || filters.look);

  const columns: TableColumn<RoleAccess>[] = [
    {
      id: "name",
      header: t("lists.roles.columns.role"),
      primary: true,
      sortable: true,
      cell: (a) => (
        <Two
          main={
            <span className="authz-inline">
              {a.role.name}
              {a.role.is_system ? <Badge size="sm">{t("lists.common.builtIn")}</Badge> : null}
            </span>
          }
          sub={a.role.description || undefined}
        />
      ),
    },
    ...(view.peopleKnown
      ? [
          {
            id: "people",
            header: t("lists.roles.columns.people"),
            numeric: true,
            sortable: true,
            sortFirst: "descending" as const,
            width: 150,
            cell: (a: RoleAccess) =>
              a.holders.size ? (
                <Two
                  end
                  main={n(a.holders.size)}
                  sub={
                    a.throughGroupsOnly
                      ? t("lists.roles.cells.throughGroups", { n: n(a.throughGroupsOnly) })
                      : undefined
                  }
                />
              ) : (
                <NoneCell />
              ),
          },
        ]
      : []),
    ...(view.groupsKnown
      ? [
          {
            id: "groups",
            header: t("lists.roles.columns.groups"),
            numeric: true,
            width: 110,
            cell: (a: RoleAccess) => (a.groups.length ? n(a.groups.length) : <NoneCell />),
          },
        ]
      : []),
    {
      id: "permissions",
      header: t("lists.roles.columns.permissions"),
      sortable: true,
      sortFirst: "descending",
      width: 190,
      cell: (a) =>
        a.permissions ? (
          <span className="authz-inline">
            <span className="authz-num">
              {t("lists.roles.cells.permissionsOf", {
                n: n(a.permissions.size),
                total: n(catalogue.length),
              })}
            </span>
            {catalogue.length > 0 && a.permissions.size >= catalogue.length ? (
              <Badge size="sm" tone="warning">
                {t("lists.common.all")}
              </Badge>
            ) : null}
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.roles.title")}
        count={rolesQuery.data ? roles.length : undefined}
        description={
          org ? t("lists.roles.description", { org: org.name }) : t("lists.roles.descriptionNoName")
        }
        actions={
          <>
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    icon={EllipsisIcon}
                    aria-label={t("lists.common.moreActions")}
                    variant="ghost"
                    tone="neutral"
                  />
                }
              />
              <MenuContent align="end">
                <MenuItem
                  icon={DownloadIcon}
                  disabled={roles.length === 0}
                  onClick={() => exportToCsv("roles", roles, roleCsvColumns)}
                >
                  {t("lists.common.exportCsv")}
                </MenuItem>
                <MenuItem
                  icon={DownloadIcon}
                  disabled={roles.length === 0}
                  onClick={() => exportToJson("roles", roles)}
                >
                  {t("lists.common.exportJson")}
                </MenuItem>
              </MenuContent>
            </Menu>
            {canWrite ? (
              <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                {t("lists.roles.newRole")}
              </Button>
            ) : null}
          </>
        }
        summary={
          rolesQuery.isError ? undefined : view.permissionsKnown &&
            (!caps.can("user.read") || view.peopleKnown) ? (
            <RolesBand view={view} />
          ) : (
            <BandPlaceholder cells={4} />
          )
        }
      />
      <PageContent>
        <div className="authz-page">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {rolesQuery.isError ? (
            <DataState error={rolesQuery.error} onRetry={() => rolesQuery.refetch()} />
          ) : (
            <>
              <Table<RoleAccess>
                label={t("lists.roles.title")}
                rows={onPage}
                rowId={(a) => a.role.id}
                rowLabel={(a) => a.role.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={rolesQuery.isLoading}
                renderRowLink={(a) => (
                  <Link to="/authorization/roles" search={{ ...filters, role: a.role.id }} />
                )}
                toolbar={
                  <div className="ppl-toolbar">
                    <div className="ppl-filters">
                      <SearchField
                        ref={searchRef}
                        className="ppl-search"
                        aria-label={t("lists.roles.filters.search")}
                        placeholder={t("lists.roles.filters.searchPlaceholder")}
                        value={text}
                        onValueChange={setText}
                        onSearch={(q) => set({ q: q.trim() || undefined })}
                      />
                      <Select
                        aria-label={t("lists.roles.filters.type")}
                        className="ppl-filter"
                        value={filters.type ?? ANY}
                        onValueChange={(v) =>
                          set({ type: v ? (String(v) as RoleFilters["type"]) : undefined })
                        }
                        items={[
                          { value: ANY, label: t("lists.roles.filters.anyType") },
                          ...ROLE_TYPES.map((type) => ({
                            value: type,
                            label: `${t(type === "custom" ? "lists.roles.filters.custom" : "lists.roles.filters.builtIn")} · ${n(roles.filter((r) => (type === "custom") !== r.is_system).length)}`,
                          })),
                        ]}
                      />
                    </div>
                    {/* Only once something narrows the list (QTRX-15). */}
                    {filters.type || filters.look || filters.q ? (
                      <FilterTags
                        filters={[
                          ...(filters.type
                            ? [
                                {
                                  id: "type",
                                  label: t("lists.roles.filters.type"),
                                  value: t(
                                    filters.type === "custom"
                                      ? "lists.roles.filters.custom"
                                      : "lists.roles.filters.builtIn",
                                  ),
                                },
                              ]
                            : []),
                          ...(filters.look
                            ? [
                                {
                                  id: "look",
                                  label: t("lists.common.needsALook"),
                                  value: t(`lists.roles.band.looks.${filters.look}`),
                                },
                              ]
                            : []),
                        ]}
                        onRemove={(id) => set({ [id]: undefined })}
                        onClear={() => onFiltersChange({ q: filters.q })}
                        returnFocusTo={searchRef}
                        summary={t("lists.roles.filters.summary", {
                          n: n(rows.length),
                          total: n(roles.length),
                        })}
                      />
                    ) : null}
                  </div>
                }
                rowActions={(a) => (
                  <>
                    <MenuItem icon={SlidersHorizontalIcon} onClick={() => onRoleChange(a.role.id)}>
                      {t("lists.roles.rowActions.open")}
                    </MenuItem>
                    {caps.can("user.read") ? (
                      <MenuItem
                        icon={UsersRoundIcon}
                        render={<Link to="/users" search={{ role: a.role.name }} />}
                      >
                        {t("lists.roles.rowActions.people")}
                      </MenuItem>
                    ) : null}
                  </>
                )}
                empty={
                  filtered ? (
                    <EmptyState
                      size="section"
                      icon={ShieldCheckIcon}
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
                      icon={ShieldCheckIcon}
                      title={t("lists.roles.empty.title")}
                      description={t("lists.roles.empty.description")}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                            {t("lists.roles.newRole")}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {rows.length > PAGE_SIZE ? (
                <Pagination
                  offset={start}
                  pageSize={PAGE_SIZE}
                  itemsOnPage={onPage.length}
                  total={rows.length}
                  onOffsetChange={setOffset}
                />
              ) : null}
              {view.catalogueQuery.isError ? (
                <Text size="sm" tone="subtle">
                  {t("lists.permissions.empty.description")}
                </Text>
              ) : null}
            </>
          )}
        </div>
      </PageContent>

      <RoleDrawer roleId={roleId ?? null} view={view} onClose={() => onRoleChange(undefined)} />
      {canWrite ? (
        <NewRoleDrawer
          open={creating}
          onOpenChange={setCreating}
          roles={roles}
          onCreated={(role) => onRoleChange(role.id)}
        />
      ) : null}
    </>
  );
}
