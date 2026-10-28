import { BuildingComplexIcon, DownloadIcon, EllipsisIcon, PlusIcon } from "@qeetrix/icons";
import {
  Button,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  Table,
  type TableSort,
} from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb } from "@/modules/dashboard";
import { orgKeys } from "@/modules/organizations/api/keys";
import { orgQueries, useOrgs } from "@/modules/organizations/api/orgs";
import {
  isFiltered,
  type OrgFilters,
  type OrgRow,
  orgRows,
  visibleOrgs,
} from "@/modules/organizations/orgs-model";
import { TWO_STEP_TARGET } from "@/modules/users";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type CsvColumn, exportToCsv, exportToJson } from "@/shared/utils/data-export";
import { OrgsBand } from "./orgs-band";
import { useOrgColumns } from "./orgs-table";
import { OrgsToolbar } from "./orgs-toolbar";
import "./orgs-list.css";

const PAGE_SIZES = [25, 50, 100] as const;

const orgCsvColumns: CsvColumn<OrgRow>[] = [
  { header: "id", value: (o) => o.id },
  { header: "name", value: (o) => o.name },
  { header: "slug", value: (o) => o.slug },
  { header: "domain", value: (o) => o.domain },
  { header: "your_roles", value: (o) => o.roles.join(" ") },
  { header: "plan", value: (o) => o.plan },
  { header: "region", value: (o) => o.region },
  { header: "status", value: (o) => o.status },
  { header: "member_count", value: (o) => String(o.member_count ?? "") },
  { header: "mfa_enabled_count", value: (o) => String(o.mfa_enabled_count ?? "") },
  { header: "last_opened_at", value: (o) => o.lastUsedAt ?? "" },
  { header: "created_at", value: (o) => o.created_at },
];

export type OrgsListPageProps = {
  /** The filters and search in the page address. */
  filters: OrgFilters;
  /** Puts new filters in the address. */
  onFiltersChange: (next: OrgFilters) => void;
};

/**
 * Directory › Organisations: the organisations you belong to, and your place in each. The key
 * numbers sit in the header, each a filter; a name opens the organisation's page; Switch moves the
 * session into it. Every page of the server's list is read, not just the first.
 */
export function OrgsListPage({ filters, onFiltersChange }: OrgsListPageProps) {
  const { t } = useTranslation("organizations");
  const navigate = useNavigate();
  const access = useCapabilities();
  const tenantId = useTenantId();
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const [switching, setSwitching] = useState<string | null>(null);

  const listQ = useOrgs();
  const mineQ = useQuery(orgQueries.memberships());
  // The organisation you're in: its record carries a scheduled deletion (the list doesn't yet,
  // QTID-963).
  const recordQ = useQuery({
    ...orgQueries.record(tenantId),
    enabled: !!tenantId && access.can("tenant.read"),
  });
  const invitesQ = useQuery({
    queryKey: orgKeys.invitations(),
    queryFn: ({ signal }) => api<{ items: unknown[] }>("/v1/me/invites", { signal }),
    staleTime: 30_000,
    meta: { silent: true },
  });

  const now = listQ.dataUpdatedAt || Date.now();
  const reading = useMemo(() => ({ now, target: TWO_STEP_TARGET }), [now]);
  const rows = useMemo(
    () => orgRows(listQ.data?.items ?? [], mineQ.data, tenantId, recordQ.data),
    [listQ.data, mineQ.data, tenantId, recordQ.data],
  );
  const shown = useMemo(
    () => visibleOrgs(rows, filters, sort, reading),
    [rows, filters, sort, reading],
  );
  const start = offset < shown.length ? offset : 0;
  const onPage = shown.slice(start, start + pageSize);
  const change = (next: OrgFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };

  // Switching moves the session into it and reloads into its dashboard. The authentication module
  // loads only now: its barrel isn't light.
  const onSwitch = async (row: OrgRow) => {
    setSwitching(row.id);
    try {
      const { switchToTenant } = await import("@/modules/authentication");
      await switchToTenant(row.id);
    } catch (err) {
      setSwitching(null);
      toast.error(errorMessage(err));
    }
  };
  const columns = useOrgColumns({ reading, switching, onSwitch: (row) => void onSwitch(row) });
  const loaded = !!listQ.data && !!mineQ.data;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("list.title")}
        count={listQ.data ? rows.length : undefined}
        description={t("list.description")}
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
                <MenuItem
                  icon={DownloadIcon}
                  disabled={rows.length === 0}
                  onClick={() => exportToCsv("organizations", rows, orgCsvColumns)}
                >
                  {t("list.exportCsv")}
                </MenuItem>
                <MenuItem
                  icon={DownloadIcon}
                  disabled={rows.length === 0}
                  onClick={() => exportToJson("organizations", rows)}
                >
                  {t("list.exportJson")}
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button
              icon={PlusIcon}
              onClick={() =>
                void navigate({ to: "/create-organization", search: { from: "organizations" } })
              }
            >
              {t("list.new")}
            </Button>
          </>
        }
        summary={
          loaded ? (
            <OrgsBand rows={rows} reading={reading} invitations={invitesQ.data?.items.length} />
          ) : listQ.isError || mineQ.isError ? undefined : (
            <BandPlaceholder />
          )
        }
      />
      <PageContent>
        <div className="ppl org">
          {listQ.isError ? (
            <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
          ) : (
            <>
              <Table<OrgRow>
                label={t("list.title")}
                rows={onPage}
                rowId={(row) => row.id}
                rowLabel={(row) => row.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={!loaded && !mineQ.isError}
                toolbar={
                  <OrgsToolbar
                    filters={filters}
                    onFiltersChange={change}
                    rows={rows}
                    shown={shown.length}
                    reading={reading}
                  />
                }
                empty={
                  <EmptyState
                    size="section"
                    icon={BuildingComplexIcon}
                    title={
                      isFiltered(filters) ? t("list.empty.filteredTitle") : t("list.empty.title")
                    }
                    description={
                      isFiltered(filters)
                        ? t("list.empty.filteredDescription")
                        : t("list.empty.description")
                    }
                    actions={
                      isFiltered(filters) ? (
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("list.empty.clear")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              {shown.length > PAGE_SIZES[0] ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={shown.length}
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
    </>
  );
}

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
function BandPlaceholder() {
  return (
    <div className="ppl-band" aria-hidden="true">
      {[0, 1, 2, 3].map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
