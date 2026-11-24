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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useInvitations } from "@/modules/users/api/invitations";
import {
  EXPORT_CAP,
  searchAllUsers,
  type User,
  useUserSearch,
  useUserStats,
  useUserTrends,
} from "@/modules/users/api/users";
import { AddPeopleDrawer } from "@/modules/users/components/add-people/add-people-drawer";
import { EditUserSheet } from "@/modules/users/components/edit-user-sheet";
import { SetPasswordSheet } from "@/modules/users/components/set-password-sheet";
import { type PeopleFilters, personName, userQuery } from "@/modules/users/people-model";
import { useUserActions } from "@/modules/users/use-user-actions";
import { useOrganizationId, useUserId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
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
 * live in the page address so a view can be shared. The server searches, filters, sorts and counts;
 * for the two filters it doesn't have, the page works over the people it loads.
 */
export function UsersPage({ filters, onFiltersChange }: UsersPageProps) {
  const { t } = useTranslation(["users", "common"]);
  const access = useCapabilities();
  const canWrite = access.can("user.write");
  const organizationId = useOrganizationId();
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
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => userQuery(filters, sort), [filters, sort]);
  const search = useUserSearch(query ?? {}, {
    offset,
    pageSize,
    enabled: !!query && filters.status !== "suspended",
  });
  const stats = useUserStats();
  const trends = useUserTrends();
  const invitations = useInvitations(canWrite);
  const org = useOrgs().data?.items.find((item) => item.id === organizationId);

  // One moment for the rows, when they arrived, so each one's last active agrees with the filter.
  const now = search.dataUpdatedAt || Date.now();
  const columns = usePeopleColumns(currentUserId, now);
  const list = {
    rows: (query && search.data?.items) || NO_ONE,
    // With no read to make, no one matches, whatever the last list left behind.
    matched: (query && search.data?.total) || 0,
    loading: !!query && search.isLoading,
    failure: query && search.isError ? search.error : null,
    retry: () => void search.refetch(),
  };
  const filtered = Object.values(filters).some(Boolean);

  useEffect(() => {
    if (!canWrite) {
      setEditing(null);
      setSettingPassword(null);
      // setCreating is a useState setter, so it is stable and never re-triggers this.
      setCreating(false);
    }
  }, [canWrite, setCreating]);

  const total = stats.data?.total ?? 0;
  const pending = invitations.data?.items.filter((i) => i.status === "pending").length;
  // Everyone the list has shown, so a selection kept across pages still knows who it holds.
  const shown = useRef(new Map<string, User>());
  for (const u of list.rows) shown.current.set(u.id, u);

  // Everyone the filters leave, in the table's order: the server pages every order.
  const exportList = async (as: "csv" | "json") => {
    setExporting(true);
    try {
      const people = await searchAllUsers(query ?? {});
      if (as === "csv") exportToCsv("users", people, peopleCsvColumns);
      else exportToJson("users", people);
      if (list.matched > EXPORT_CAP)
        toast.info(t("people.exportCapped", { n: formatNumber(EXPORT_CAP, formatLocale()) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
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
                  disabled={list.matched === 0 || exporting}
                  onClick={() => void exportList("csv")}
                >
                  {t("people.exportCsv")}
                </MenuItem>
                <MenuItem
                  icon={DownloadIcon}
                  disabled={list.matched === 0 || exporting}
                  onClick={() => void exportList("json")}
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
          stats.data ? (
            <PeopleBand stats={stats.data} trends={trends.data} />
          ) : stats.isError ? undefined : (
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
          {filters.status === "suspended" ? (
            <SuspendedPeople
              filters={filters}
              onFiltersChange={onFiltersChange}
              stats={stats.data}
              canWrite={canWrite}
            />
          ) : list.failure ? (
            <DataState error={list.failure} onRetry={list.retry} />
          ) : (
            <>
              <Table<User>
                label={t("people.title")}
                rows={list.rows}
                rowId={(u) => u.id}
                rowLabel={personName}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                selectable={canWrite}
                selected={canWrite ? selected : []}
                onSelectedChange={setSelected}
                loading={list.loading}
                toolbar={
                  <PeopleToolbar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    stats={stats.data}
                    shown={list.matched}
                  />
                }
                bulkActions={(ids) => (
                  <PeopleBulkActions
                    selected={ids.flatMap((id) => shown.current.get(id) ?? [])}
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
              {list.matched > 0 ? (
                <Pagination
                  offset={offset}
                  pageSize={pageSize}
                  itemsOnPage={list.rows.length}
                  total={list.matched}
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
    </>
  );
}
