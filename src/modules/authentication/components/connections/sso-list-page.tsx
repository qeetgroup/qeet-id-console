import { AppWindowIcon, ArrowRightIcon, PlusIcon, WorkflowIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Link,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Skeleton,
  Table,
  type TableColumn,
  type TableSort,
  Text,
} from "@qeetrix/react";
import {
  type AppliedFilter,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
} from "@qeetrix/react/experimental";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useAdminPortalLinks } from "@/modules/authentication/api/admin-portal";
import { useSamlConnections } from "@/modules/authentication/api/saml";
import { useSamlProviders } from "@/modules/authentication/api/saml-idp";
import { readCertificate } from "@/modules/authentication/certificate-model";
import { SamlDrawer } from "@/modules/authentication/components/saml/saml-drawer";
import {
  byLastUsed,
  type ConnectionKind,
  type ConnectionListFilters,
  type ConnectionRow,
  connectionRows,
  KIND_GROUP,
  setupLinkState,
  shownRows,
} from "@/modules/authentication/connections-model";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import { StatusBadge } from "./connection-parts";
import { SetupLinks } from "./setup-links";
import { SsoBand, SsoToolbar } from "./sso-band";
import "./connections.css";

const KIND_ICON = { saml: WorkflowIcon, app: AppWindowIcon } as const;

/** A connection's own page: a SAML connection's setup page, or the SAML apps. */
function pageOf(row: Pick<ConnectionRow, "kind" | "id">) {
  return row.kind === "saml"
    ? ({ to: "/auth/connections/saml/$id", params: { id: row.id } } as const)
    : ({ to: "/auth/connections/saml-idp" } as const);
}

export type SsoListPageProps = {
  filters: ConnectionListFilters;
  onFiltersChange: (next: ConnectionListFilters) => void;
  /** New SAML connection asked for (`?action=create`): its drawer opens. */
  creating: boolean;
  onCreatingChange: (open: boolean) => void;
};

/**
 * Authentication › SSO: the one home of SAML. The connections people sign in through (each opens
 * its setup page) and the SAML apps Qeet ID signs them in to, in one status word each; the kinds
 * not set up yet offered under the list; then the setup links, which let an outside IT admin set
 * up SAML or SCIM. LDAP and SCIM have their one home in Directories › Connections.
 */
export function SsoListPage({
  filters,
  onFiltersChange,
  creating,
  onCreatingChange,
}: SsoListPageProps) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const navigate = useNavigate();
  const canWrite = useCapabilities().can("connection.write");
  const [sort, setSort] = useState<TableSort | null>({ column: "used", direction: "descending" });

  const samlQ = useSamlConnections();
  const appsQ = useSamlProviders();
  const linksQ = useAdminPortalLinks();
  const queries = [samlQ, appsQ];
  const loaded = queries.every((q) => !!q.data);
  const failed = queries.find((q) => q.isError);
  const now = samlQ.dataUpdatedAt || Date.now();

  const rows = useMemo(
    () =>
      connectionRows({
        saml: samlQ.data?.items ?? [],
        apps: appsQ.data?.items ?? [],
        certificateEnds: (c) => readCertificate(c.idp_certificate)?.notAfter ?? null,
        now,
      }),
    [samlQ.data, appsQ.data, now],
  );
  const matching = shownRows(rows, filters);
  const shown = sort?.column === "used" ? byLastUsed(matching, sort.direction) : matching;

  const count = (test: (r: ConnectionRow) => boolean) => rows.filter(test).length;
  const activeLinks = (linksQ.data?.items ?? []).filter(
    (l) => setupLinkState(l, now) === "active",
  ).length;
  const missing = (
    [
      ["saml", !(samlQ.data?.items.length ?? 0)],
      ["app", !(appsQ.data?.items.length ?? 0)],
    ] as const
  )
    .filter(([, none]) => none)
    .map(([kind]) => kind);

  const newConnection = (kind: ConnectionKind) => {
    if (kind === "saml") onCreatingChange(true);
    else void navigate({ to: "/auth/connections/saml-idp", search: { action: "create" } });
  };

  const columns: TableColumn<ConnectionRow>[] = [
    {
      id: "name",
      header: t("list.columns.name"),
      primary: true,
      cell: (r) => (
        <span className="cx-name">
          <strong>{r.name}</strong>
          <small>{r.line}</small>
        </span>
      ),
    },
    {
      id: "kind",
      header: t("list.columns.kind"),
      width: 170,
      cell: (r) => t(`kind.${r.kind}`),
    },
    {
      id: "status",
      header: t("list.columns.status"),
      width: 230,
      cell: (r) => (
        <span className="cx-name">
          <span>
            <StatusBadge status={r.status} size="sm" />
          </span>
          {r.problem ? <small>{t(`list.problem.${r.problem}`)}</small> : null}
        </span>
      ),
    },
    {
      id: "used",
      header: t("list.columns.used"),
      width: 140,
      sortable: true,
      sortFirst: "descending",
      cell: (r) =>
        r.lastUsed ? (
          <time
            className="cx-nowrap"
            dateTime={r.lastUsed}
            title={formatDateTime(r.lastUsed, locale)}
          >
            {formatRelativeTime(Date.parse(r.lastUsed), locale, now)}
          </time>
        ) : (
          <Text tone="subtle">{t("list.never")}</Text>
        ),
    },
  ];

  const tags: AppliedFilter[] = [];
  if (filters.show)
    tags.push({ id: "show", label: t("band.needsALook"), value: t(`list.show.${filters.show}`) });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("list.title")}
        count={loaded ? rows.length : undefined}
        description={t("list.description")}
        actions={
          canWrite ? (
            <Menu>
              <MenuTrigger render={<Button icon={PlusIcon}>{t("list.new")}</Button>} />
              <MenuContent align="end">
                <MenuItem icon={WorkflowIcon} onClick={() => newConnection("saml")}>
                  {t("kinds.saml")}
                </MenuItem>
                <MenuItem icon={AppWindowIcon} onClick={() => newConnection("app")}>
                  {t("kinds.app")}
                </MenuItem>
              </MenuContent>
            </Menu>
          ) : undefined
        }
        summary={
          loaded ? (
            <SsoBand rows={rows} links={activeLinks} />
          ) : failed ? undefined : (
            <div className="ppl-band is-three" aria-hidden="true">
              {[0, 1, 2].map((cell) => (
                <div key={cell} className="ppl-cell">
                  <Skeleton className="ppl-skeleton-label" />
                  <Skeleton className="ppl-skeleton-value" />
                  <Skeleton lines={2} />
                </div>
              ))}
            </div>
          )
        }
        tabs={
          <PageTabs>
            <PageTabList />
          </PageTabs>
        }
      />
      <PageContent>
        <div className="ppl">
          {failed ? (
            <DataState
              error={failed.error}
              onRetry={() => queries.forEach((q) => void q.refetch())}
            />
          ) : (
            <>
              {tags.length ? (
                <FilterTags
                  filters={tags}
                  onRemove={() => onFiltersChange({ ...filters, show: undefined })}
                  onClear={() => onFiltersChange({})}
                  summary={t("list.shown", { n: n(shown.length), total: n(rows.length) })}
                />
              ) : null}
              <Table<ConnectionRow>
                label={t("list.title")}
                rows={shown}
                rowId={(r) => `${r.kind}:${r.id}`}
                rowLabel={(r) => r.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={!loaded}
                renderRowLink={(r) => <RouterLink {...pageOf(r)} />}
                toolbar={
                  <SsoToolbar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    counts={{
                      signin: count((r) => KIND_GROUP[r.kind] === "signin"),
                      apps: count((r) => KIND_GROUP[r.kind] === "apps"),
                    }}
                  />
                }
                rowActions={(r) => (
                  <MenuItem icon={ArrowRightIcon} onClick={() => void navigate(pageOf(r))}>
                    {r.status === "setup" || r.status === "attention"
                      ? t("list.actions.finish")
                      : t("list.actions.open")}
                  </MenuItem>
                )}
                empty={
                  <EmptyState
                    size="section"
                    icon={WorkflowIcon}
                    title={rows.length ? t("list.emptyFiltered.title") : t("list.empty.title")}
                    description={
                      rows.length
                        ? t("list.emptyFiltered.description")
                        : t("list.empty.description")
                    }
                    actions={
                      rows.length ? (
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("list.emptyFiltered.clear")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              {/* LDAP and SCIM have one home, Directories › Connections. */}
              <p className="cx-elsewhere">
                {t("list.elsewhere")}{" "}
                <Link render={<RouterLink to="/directory/connections" />}>
                  {t("list.elsewhereLink")}
                </Link>
              </p>
              {loaded && missing.length ? (
                <section className="account-section" aria-label={t("offers.label")}>
                  <ul className="account-rows">
                    {missing.map((kind) => {
                      const Icon = KIND_ICON[kind];
                      return (
                        <li key={kind} className="account-row">
                          <span className="account-icon" aria-hidden="true">
                            <Icon />
                          </span>
                          <span className="account-row-text">
                            <span className="account-row-name">
                              <strong>{t(`kinds.${kind}`)}</strong>
                              <Badge size="sm">{t("status.none")}</Badge>
                            </span>
                            <small>{t(`offers.${kind}`)}</small>
                          </span>
                          {canWrite ? (
                            <span className="account-row-actions">
                              <Button
                                variant="ghost"
                                icon={PlusIcon}
                                onClick={() => newConnection(kind)}
                              >
                                {t(`offers.${kind}Action`)}
                              </Button>
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
            </>
          )}
          <SetupLinks canWrite={canWrite} />
        </div>
      </PageContent>
      <SamlDrawer open={creating} onOpenChange={onCreatingChange} />
    </>
  );
}
