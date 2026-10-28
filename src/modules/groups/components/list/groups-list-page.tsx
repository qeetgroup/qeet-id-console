import {
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  LayoutTemplateIcon,
  PlusIcon,
  UploadIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import {
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
  Table,
  type TableSort,
} from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { groupRoleQueries } from "@/modules/authorization";
import { PageBreadcrumb } from "@/modules/dashboard";
import { type Group, useGroups } from "@/modules/groups/api/groups";
import { GroupDrawer } from "@/modules/groups/components/group-drawer";
import { GroupMembersDrawer } from "@/modules/groups/components/group-members-drawer";
import { GroupTemplatesDrawer } from "@/modules/groups/components/group-templates-drawer";
import { ImportGroupsDrawer } from "@/modules/groups/components/import-groups-drawer";
import {
  everyGroup,
  FOLD_OVER,
  foldable,
  type GroupFilters,
  type GroupRow,
  groupTree,
  isFlat,
  pageOf,
  visibleGroups,
} from "@/modules/groups/groups-model";
import { useDeleteGroupFlow } from "@/modules/groups/use-delete-group";
import { useOrgs } from "@/modules/organizations";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { GroupsBand } from "./groups-band";
import { GroupRowActions, useGroupColumns } from "./groups-table";
import { GroupsToolbar } from "./groups-toolbar";
import "./groups-list.css";

const PAGE_SIZES = [25, 50, 100] as const;
// Every group's roles are read one group at a time (no list endpoint, QTID-961): all of them up to
// this many groups, so the roles filter and "grant roles to no one" are whole; past it, only the
// groups on the page, and those two wait for the server.
const ROLES_FOR_ALL_UP_TO = 100;
const NO_GROUPS: Group[] = [];

const groupCsvColumns: CsvColumn<Group>[] = [
  { header: "id", value: (g) => g.id },
  { header: "name", value: (g) => g.name },
  { header: "description", value: (g) => g.description },
  { header: "parent_id", value: (g) => g.parent_id },
  { header: "member_count", value: (g) => g.member_count },
  { header: "created_at", value: (g) => g.created_at },
];

export type GroupsListPageProps = {
  /** The filters and search in the page address. */
  filters: GroupFilters;
  /** Puts new filters in the address. */
  onFiltersChange: (next: GroupFilters) => void;
};

/**
 * Directory › Groups: how people are grouped, and what each group grants. The table is the tree:
 * families fold (over FOLD_OVER groups they start folded), pages hold 25, 50 or 100 rows, and a
 * family that runs past a page break carries its path onto the next. A search or filter lists the
 * matches flat, each with its path. The key numbers sit in the header, each a filter.
 */
export function GroupsListPage({ filters, onFiltersChange }: GroupsListPageProps) {
  const { t } = useTranslation(["groups", "common"]);
  const access = useCapabilities();
  const canWrite = access.can("group.write");
  const canReadRoles = access.can("role.read");
  const canReadPeople = access.can("user.read");
  const tenantId = useTenantId();

  const [creating, setCreating] = useCreateIntent(canWrite);
  const [inside, setInside] = useState<Group | null>(null);
  const [editing, setEditing] = useState<Group | null>(null);
  const [members, setMembers] = useState<Group | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  // Which families are open; until someone folds or opens one, small lists start open.
  const [opened, setOpened] = useState<Set<string> | null>(null);

  const groupsQ = useGroups();
  const groups = groupsQ.data?.items ?? NO_GROUPS;
  const directory = useQuery({
    ...userQueries.directory(tenantId),
    enabled: canReadPeople && !!tenantId,
  });
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);
  const now = groupsQ.dataUpdatedAt || Date.now();

  const roots = useMemo(() => groupTree(groups), [groups]);
  const all = useMemo(() => everyGroup(roots), [roots]);
  const parents = useMemo(() => foldable(roots), [roots]);
  const open = useMemo(
    () => opened ?? new Set(all.length > FOLD_OVER ? [] : parents),
    [opened, all.length, parents],
  );
  const allOpen = parents.length > 0 && parents.every((id) => open.has(id));
  const flat = isFlat(filters);

  // Roles: everyone's while the list is small enough; otherwise the rows on show (below).
  const [pageIds, setPageIds] = useState<string[]>([]);
  const roleIds = canReadRoles
    ? all.length <= ROLES_FOR_ALL_UP_TO
      ? all.map((g) => g.id)
      : pageIds
    : [];
  const roleResults = useQueries({
    queries: roleIds.map((id) => groupRoleQueries.list(tenantId, id)),
  });
  const roles = useMemo(() => {
    const out = new Map<string, string[]>();
    roleResults.forEach((r, i) => {
      const id = roleIds[i];
      if (id && r.data)
        out.set(
          id,
          r.data.items.map((role) => role.name),
        );
    });
    return out;
  }, [roleResults, roleIds]);
  const rolesWhole = canReadRoles && all.length > 0 && all.every((g) => roles.has(g.id));

  const rows = useMemo(
    () => visibleGroups(roots, filters, open, roles, sort),
    [roots, filters, open, roles, sort],
  );
  const start = offset < rows.length ? offset : 0;
  const onPage: GroupRow[] = pageOf(rows, start, pageSize, flat);
  const onPageKey = onPage.map((g) => g.id).join(",");
  if (all.length > ROLES_FOR_ALL_UP_TO && onPageKey !== pageIds.join(","))
    setPageIds(onPage.map((g) => g.id));

  const toggle = (id: string) =>
    setOpened(() => {
      const next = new Set(open);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const columns = useGroupColumns({ flat, open, onToggle: toggle, roles });
  const change = (next: GroupFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };

  const remove = useDeleteGroupFlow(groups);

  const filtered = flat || !!filters.inside;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("list.title")}
        count={groupsQ.data ? groups.length : undefined}
        description={org ? t("list.description", { org: org.name }) : t("list.descriptionNoName")}
        actions={
          <>
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    icon={EllipsisIcon}
                    aria-label={t("list.moreActions")}
                    variant="ghost"
                    tone="neutral"
                  />
                }
              />
              <MenuContent align="end">
                {canWrite ? (
                  <>
                    <MenuItem icon={LayoutTemplateIcon} onClick={() => setTemplatesOpen(true)}>
                      {t("list.fromTemplate")}
                    </MenuItem>
                    <MenuItem icon={UploadIcon} onClick={() => setImportOpen(true)}>
                      {t("list.importFromFile")}
                    </MenuItem>
                    <MenuSeparator />
                  </>
                ) : null}
                <MenuItem
                  icon={DownloadIcon}
                  disabled={groups.length === 0}
                  onClick={() => exportToCsv("groups", groups, groupCsvColumns)}
                >
                  {t("list.exportCsv")}
                </MenuItem>
                <MenuItem
                  icon={DownloadIcon}
                  disabled={groups.length === 0}
                  onClick={() => exportToJson("groups", groups)}
                >
                  {t("list.exportJson")}
                </MenuItem>
              </MenuContent>
            </Menu>
            {canWrite ? (
              <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                {t("list.newGroup")}
              </Button>
            ) : null}
          </>
        }
        summary={
          groupsQ.data && (!canReadPeople || directory.data) ? (
            <GroupsBand
              all={all}
              people={directory.data?.items}
              roles={rolesWhole ? roles : undefined}
              now={now}
            />
          ) : groupsQ.isError ? undefined : (
            <BandPlaceholder cells={canReadPeople ? 4 : 3} />
          )
        }
      />
      <PageContent>
        <div className="ppl grp">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {groupsQ.isError ? (
            <DataState error={groupsQ.error} onRetry={() => groupsQ.refetch()} />
          ) : (
            <>
              <Table<GroupRow>
                label={t("list.title")}
                rows={onPage}
                rowId={(g) => g.id}
                rowLabel={(g) => g.name}
                columns={canReadRoles ? columns : columns.filter((c) => c.id !== "roles")}
                sort={sort}
                onSortChange={setSort}
                loading={groupsQ.isLoading}
                toolbar={
                  <GroupsToolbar
                    filters={filters}
                    onFiltersChange={change}
                    all={all}
                    roles={rolesWhole ? roles : undefined}
                    shown={rows.length}
                    allOpen={allOpen}
                    onFoldAll={() => setOpened(new Set(allOpen ? [] : parents))}
                  />
                }
                rowActions={
                  canWrite
                    ? (g) => (
                        <GroupRowActions
                          group={g}
                          onAddMembers={setMembers}
                          onAddInside={setInside}
                          onEdit={setEditing}
                          onDelete={(g) => remove(g)}
                        />
                      )
                    : undefined
                }
                empty={
                  filtered ? (
                    <EmptyState
                      size="section"
                      icon={UsersRoundIcon}
                      title={t("list.empty.filteredTitle")}
                      description={t("list.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("list.empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={UsersRoundIcon}
                      title={t("list.empty.title")}
                      description={t("list.empty.description")}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                            {t("list.newGroup")}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {rows.length > 0 ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={rows.length}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setOffset(0);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <GroupDrawer
            open={creating || !!inside || !!editing}
            onOpenChange={(o) => {
              if (o) return;
              setCreating(false);
              setInside(null);
              setEditing(null);
            }}
            groups={groups}
            people={directory.data?.items}
            group={editing}
            parentId={inside?.id}
            onUseTemplate={() => {
              setCreating(false);
              setInside(null);
              setTemplatesOpen(true);
            }}
          />
          <GroupMembersDrawer
            group={members}
            onClose={() => setMembers(null)}
            path={
              members ? [...(all.find((g) => g.id === members.id)?.path ?? []), members.name] : []
            }
            grants={members && canReadRoles ? roles.get(members.id) : undefined}
            people={directory.data?.items ?? []}
          />
          <GroupTemplatesDrawer
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            groups={groups}
          />
          <ImportGroupsDrawer open={importOpen} onOpenChange={setImportOpen} groups={groups} />
        </>
      ) : null}
    </>
  );
}

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
function BandPlaceholder({ cells }: { cells: 3 | 4 }) {
  return (
    <div className={cells === 3 ? "ppl-band is-three" : "ppl-band"} aria-hidden="true">
      {Array.from({ length: cells }, (_, cell) => cell).map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
