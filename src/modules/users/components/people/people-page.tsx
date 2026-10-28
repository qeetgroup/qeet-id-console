import {
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  PlusIcon,
  UploadIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatNumber,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
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
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useInvitations } from "@/modules/users/api/invitations";
import {
  DIRECTORY_CAP,
  type User,
  useUserDirectory,
  useUserStats,
} from "@/modules/users/api/users";
import { AddPeopleDrawer } from "@/modules/users/components/add-people/add-people-drawer";
import { EditUserSheet } from "@/modules/users/components/edit-user-sheet";
import { SetPasswordSheet } from "@/modules/users/components/set-password-sheet";
import { matches, type PeopleFilters, personName, sortPeople } from "@/modules/users/people-model";
import { useUserActions } from "@/modules/users/use-user-actions";
import { useTenantId, useUserId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { BandPlaceholder } from "./band-placeholder";
import { PeopleBand } from "./people-band";
import { PeopleBulkActions, peopleCsvColumns, usePeopleRun } from "./people-bulk";
import { PeopleRowActions, usePeopleColumns } from "./people-table";
import { SuspendedPeople } from "./people-suspended";
import { PeopleToolbar } from "./people-toolbar";
import { useKeyedState } from "./use-keyed-state";
import "./people.css";

const PAGE_SIZES = [25, 50, 100] as const;
const NO_ONE: User[] = [];

export type UsersPageProps = {
  /** The filters and search in the page address. */
  filters: PeopleFilters;
  /** Puts new filters in the address. */
  onFiltersChange: (next: PeopleFilters) => void;
};

/**
 * Directory › Users: everyone in the organisation, how they sign in, and who needs a look. The key
 * numbers sit in the header above the tabs; search and filters sit in one row over the table, and
 * live in the page address so a view can be shared.
 */
export function UsersPage({ filters, onFiltersChange }: UsersPageProps) {
  const { t } = useTranslation(["users", "common"]);
  const access = useCapabilities();
  const canWrite = access.can("user.write");
  const tenantId = useTenantId();
  const currentUserId = useUserId();
  const actions = useUserActions();

  const [creating, setCreating] = useCreateIntent(canWrite);
  const [editing, setEditing] = useState<User | null>(null);
  const [settingPassword, setSettingPassword] = useState<User | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  // New filters start again with nothing selected; new filters, a new sort or a new page size,
  // from the first page.
  const filterKey = JSON.stringify(filters);
  const [selected, setSelected] = useKeyedState<string[]>(filterKey, []);
  const [offset, setOffset] = useKeyedState(
    `${filterKey}|${sort?.column}|${sort?.direction}|${pageSize}`,
    0,
  );
  const { run } = usePeopleRun();

  const directory = useUserDirectory();
  const stats = useUserStats();
  const invitations = useInvitations(canWrite);
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);

  // One moment for the whole page, when the people arrived, so every count agrees.
  const now = directory.dataUpdatedAt || Date.now();
  const columns = usePeopleColumns(currentUserId, now);
  const users = directory.data?.items ?? NO_ONE;
  const rows = useMemo(
    () =>
      sortPeople(
        users.filter((u) => matches(u, filters, now)),
        sort,
      ),
    [users, filters, now, sort],
  );
  const onPage = rows.slice(offset, offset + pageSize);
  const filtered = Object.values(filters).some(Boolean);

  useEffect(() => {
    if (!canWrite) {
      setEditing(null);
      setSettingPassword(null);
      // setCreating is a useState setter, so it is stable and never re-triggers this.
      setCreating(false);
    }
  }, [canWrite, setCreating]);

  const total = stats.data?.total ?? users.length;
  const pending = invitations.data?.items.filter((i) => i.status === "pending").length;
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("people.title")}
        count={stats.data ? total : undefined}
        description={
          org ? t("people.description", { org: org.name }) : t("people.descriptionNoName")
        }
        actions={
          <>
            <Menu>
              <MenuTrigger
                render={
                  <IconButton
                    icon={EllipsisIcon}
                    aria-label={t("people.moreActions")}
                    variant="ghost"
                    tone="neutral"
                  />
                }
              />
              <MenuContent align="end">
                {canWrite ? (
                  <MenuItem icon={UploadIcon} render={<Link to="/users/import" />}>
                    {t("people.importFromFile")}
                  </MenuItem>
                ) : null}
                <MenuItem
                  icon={DownloadIcon}
                  disabled={rows.length === 0}
                  onClick={() => exportToCsv("users", rows, peopleCsvColumns)}
                >
                  {t("people.exportCsv")}
                </MenuItem>
                <MenuItem
                  icon={DownloadIcon}
                  disabled={rows.length === 0}
                  onClick={() => exportToJson("users", rows)}
                >
                  {t("people.exportJson")}
                </MenuItem>
              </MenuContent>
            </Menu>
            {canWrite ? (
              <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                {t("people.addUser")}
              </Button>
            ) : null}
          </>
        }
        summary={
          directory.data && stats.data ? (
            <PeopleBand stats={stats.data} users={users} now={now} />
          ) : directory.isError || stats.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={
          <PageTabList
            badges={{ "/invitations": pending, "/users/suspended": stats.data?.suspended }}
          />
        }
      />
      <PageContent>
        <div className="ppl">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {directory.data && !directory.data.complete ? (
            <Alert
              tone="info"
              title={t("people.capped.title", {
                n: formatNumber(DIRECTORY_CAP, formatLocale()),
                total: formatNumber(total, formatLocale()),
              })}
            >
              {t("people.capped.description")}
            </Alert>
          ) : null}
          {filters.status === "suspended" ? (
            <SuspendedPeople
              filters={filters}
              onFiltersChange={onFiltersChange}
              users={users}
              canWrite={canWrite}
            />
          ) : directory.isError ? (
            <DataState error={directory.error} onRetry={() => directory.refetch()} />
          ) : (
            <>
              <Table<User>
                label={t("people.title")}
                rows={onPage}
                rowId={(u) => u.id}
                rowLabel={personName}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                selectable={canWrite}
                selected={canWrite ? selected : []}
                onSelectedChange={setSelected}
                loading={directory.isLoading}
                toolbar={
                  <PeopleToolbar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    users={users}
                    shown={rows.length}
                  />
                }
                bulkActions={(ids) => (
                  <PeopleBulkActions
                    selected={ids.flatMap((id) => byId.get(id) ?? [])}
                    currentUserId={currentUserId}
                    onDone={() => setSelected([])}
                  />
                )}
                rowActions={
                  canWrite
                    ? (u) => (
                        <PeopleRowActions
                          user={u}
                          isSelf={u.id === currentUserId}
                          handlers={{
                            actions,
                            run,
                            onEdit: setEditing,
                            onSetPassword: setSettingPassword,
                          }}
                        />
                      )
                    : undefined
                }
                renderRowLink={(u) => <Link to="/users/$userId" params={{ userId: u.id }} />}
                empty={
                  filtered ? (
                    <EmptyState
                      size="section"
                      icon={UserRoundIcon}
                      title={t("people.empty.filteredTitle")}
                      description={t("people.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("people.empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={UserRoundIcon}
                      title={t("list.emptyTitle")}
                      description={t("people.empty.description")}
                    />
                  )
                }
              />
              {rows.length > 0 ? (
                <Pagination
                  offset={offset}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={rows.length}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={setPageSize}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>

      {canWrite ? <AddPeopleDrawer open={creating} onOpenChange={setCreating} /> : null}
      {canWrite ? (
        <>
          <EditUserSheet user={editing} onOpenChange={(open) => !open && setEditing(null)} />
          <SetPasswordSheet
            user={settingPassword}
            onOpenChange={(open) => !open && setSettingPassword(null)}
          />
        </>
      ) : null}
    </PageTabs>
  );
}
