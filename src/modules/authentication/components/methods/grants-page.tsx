import { KeyRoundIcon, SearchIcon, TrashIcon } from "@qeetrix/icons";
import {
  Button,
  formatNumber,
  MenuItem,
  MenuSeparator,
  Table,
  type TableColumn,
  type TableSort,
  Text,
} from "@qeetrix/react";
import {
  Alert,
  AvatarItem,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { ACCESS, type GrantFilters, type GrantRow, matchesGrant, sortGrants } from "./grants-model";
import { When } from "./methods-parts";
import { GrantsBand } from "./grants-band";
import { GrantsToolbar } from "./grants-toolbar";
import { useGrantRows } from "./use-grant-rows";
import { useNarrow } from "./use-narrow";
import { useRevokeGrants } from "./use-revoke-grants";
import "./methods.css";

const PAGE_SIZES = [25, 50, 100] as const;

export type ConsentGrantsPageProps = {
  /** The filters and search in the page address. */
  filters: GrantFilters;
  onFiltersChange: (next: GrantFilters) => void;
};

/**
 * Applications › OAuth grants: per person, which applications they let keep them signed in, with
 * what access. The key numbers sit in the header; search and the filters in one row over the
 * table, in the page address. Revoking ends a person's refresh-token chain for that application,
 * so it has to send them through sign-in again.
 */
export function ConsentGrantsPage({ filters, onFiltersChange }: ConsentGrantsPageProps) {
  const { t } = useTranslation("consent");
  const access = useCapabilities();
  const canRevoke = access.can("connection.write");
  const canPeople = access.can("user.read");
  const runSensitive = useSensitiveAction();
  const revoke = useRevokeGrants();
  const { grants, rows: all } = useGrantRows();
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const narrow = useNarrow();

  const [sort, setSort] = useState<TableSort | null>({
    column: "renewed",
    direction: "descending",
  });
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const filterKey = JSON.stringify(filters);
  const [paging, setPaging] = useState({ key: "", offset: 0 });
  const pageKey = `${filterKey}|${sort?.column}|${sort?.direction}|${pageSize}`;
  const offset = paging.key === pageKey ? paging.offset : 0;
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const selected = selection.key === filterKey ? selection.ids : [];

  const rows = useMemo(
    () =>
      sortGrants(
        all.filter((row) => matchesGrant(row, filters)),
        sort,
      ),
    [all, filters, sort],
  );
  const onPage = rows.slice(offset, offset + pageSize);
  const byId = new Map(all.map((row) => [row.id, row]));
  const filtered = Boolean(filters.q || filters.app || filters.access);
  const words = (scopes: string[]) =>
    ACCESS.filter((a) => scopes.includes(a))
      .map((a) => t(`access.${a}`))
      .join(", ") || t("access.signInOnly");

  // Revoking is confirmed with what happens to the people it reaches.
  const revokeGrants = (ids: string[]) => {
    const one = ids.length === 1 ? byId.get(ids[0] ?? "") : undefined;
    return runSensitive({
      confirm: one
        ? {
            title: t("revoke.oneTitle", { person: one.person, app: one.app }),
            description: t("revoke.oneDescription", { person: one.person, app: one.app }),
            confirmLabel: t("revoke.confirm"),
            tone: "destructive",
          }
        : {
            title: t("revoke.manyTitle", { count: ids.length }),
            description: t("revoke.manyDescription"),
            confirmLabel: t("revoke.confirm"),
            tone: "destructive",
          },
      actionLabel: t("revoke.action"),
      run: () => revoke.mutateAsync(ids),
    })
      .then((res) => {
        if (!res) return;
        setSelection({ key: filterKey, ids: [] });
        if (res.failed) toast.error(t("revoke.someFailed", { count: res.failed }));
        else toast.success(t("revoke.done", { count: res.revoked }));
      })
      .catch(settleSensitiveAction);
  };

  const allColumns: TableColumn<GrantRow>[] = [
    {
      id: "person",
      header: t("columns.person"),
      primary: true,
      sortable: true,
      cell: (g) =>
        g.person === g.user_email ? (
          <AvatarItem name={g.person} />
        ) : (
          <AvatarItem name={g.person} description={g.user_email} />
        ),
    },
    ...(filters.app
      ? []
      : [
          {
            id: "app",
            header: t("columns.application"),
            sortable: true,
            cell: (g: GrantRow) => g.app,
          },
        ]),
    { id: "access", header: t("columns.access"), cell: (g) => words(g.scopes) },
    {
      id: "renewed",
      header: t("columns.renewed"),
      sortable: true,
      sortFirst: "descending",
      numeric: true,
      cell: (g) => (
        <span className="am-nowrap">
          <When iso={g.issued_at} />
        </span>
      ),
    },
    {
      id: "ends",
      header: t("columns.ends"),
      sortable: true,
      numeric: true,
      cell: (g) => (
        <span className="am-nowrap">
          <When iso={g.expires_at} />
        </span>
      ),
    },
  ];
  // A phone keeps who and which application; the rest is a tap away in the row's menu.
  const columns = narrow
    ? allColumns.filter(
        (c) => ["person", "app"].includes(c.id) || (filters.app && c.id === "renewed"),
      )
    : allColumns;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        count={grants.data ? all.length : undefined}
        description={t("page.description")}
        summary={grants.data && all.length > 0 ? <GrantsBand rows={all} /> : undefined}
      />
      <PageContent>
        <div className="am-list">
          {grants.data?.truncated ? (
            <Alert tone="info" title={t("truncated.title", { n: n(all.length) })}>
              {t("truncated.description")}
            </Alert>
          ) : null}
          {grants.isError ? (
            <DataState error={grants.error} onRetry={() => grants.refetch()} />
          ) : (
            <>
              <Table<GrantRow>
                label={t("page.title")}
                rows={onPage}
                rowId={(g) => g.id}
                rowLabel={(g) => t("rowLabel", { person: g.person, app: g.app })}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                selectable={canRevoke && all.length > 0}
                selected={selected}
                onSelectedChange={(ids) => setSelection({ key: filterKey, ids })}
                loading={grants.isLoading}
                toolbar={
                  all.length > 0 ? (
                    <GrantsToolbar
                      filters={filters}
                      onFiltersChange={onFiltersChange}
                      rows={all}
                      shown={rows.length}
                    />
                  ) : undefined
                }
                bulkActions={(ids) =>
                  revoke.progress ? (
                    <Text tone="subtle" role="status">
                      {t("revoke.progress", revoke.progress)}
                    </Text>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={TrashIcon}
                      onClick={() => void revokeGrants(ids)}
                    >
                      {t("revoke.many", { count: ids.length })}
                    </Button>
                  )
                }
                rowActions={(g) => (
                  <>
                    {canPeople && (
                      <MenuItem
                        render={<Link to="/users/$userId" params={{ userId: g.user_id }} />}
                      >
                        {t("actions.openPerson", { person: g.person })}
                      </MenuItem>
                    )}
                    {g.appType && (
                      <MenuItem
                        render={
                          <Link
                            to="/auth/connections/oidc/$clientId"
                            params={{ clientId: g.client_id }}
                          />
                        }
                      >
                        {t("actions.openApp", { app: g.app })}
                      </MenuItem>
                    )}
                    {canRevoke && (
                      <>
                        {(canPeople || g.appType) && <MenuSeparator />}
                        <MenuItem tone="danger" onClick={() => void revokeGrants([g.id])}>
                          {t("actions.revoke")}
                        </MenuItem>
                      </>
                    )}
                  </>
                )}
                empty={
                  filtered ? (
                    <EmptyState
                      size="section"
                      icon={SearchIcon}
                      title={t("empty.filteredTitle")}
                      description={t("empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={KeyRoundIcon}
                      title={t("empty.title")}
                      description={t("empty.description")}
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
                  onOffsetChange={(next) => setPaging({ key: pageKey, offset: next })}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={setPageSize}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>
    </>
  );
}
