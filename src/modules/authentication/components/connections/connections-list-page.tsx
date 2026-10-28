import {
  AppWindowIcon,
  ArrowRightIcon,
  NetworkIcon,
  PlusIcon,
  ServerIcon,
  WorkflowIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
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
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useAdminPortalLinks } from "@/modules/authentication/api/admin-portal";
import { useLdapConnections } from "@/modules/authentication/api/ldap";
import { useSamlConnections } from "@/modules/authentication/api/saml";
import { useSamlProviders } from "@/modules/authentication/api/saml-idp";
import { useScimConfig } from "@/modules/authentication/api/scim";
import { readCertificate } from "@/modules/authentication/certificate-model";
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
import { PageBreadcrumb } from "@/modules/dashboard";
import { useDirectoryConnections, useDirectoryErrors } from "@/modules/directory";
import { useCapabilities } from "@/platform/security/capability-provider";
import { StatusBadge } from "./connection-parts";
import { ConnectionsBand, Toolbar } from "./connections-band";
import { SetupLinks } from "./setup-links";
import "./connections.css";

const KIND_ICON = {
  saml: WorkflowIcon,
  ldap: ServerIcon,
  scim: NetworkIcon,
  app: AppWindowIcon,
} as const;

/** A connection's own page, by its kind. */
function pageOf(row: Pick<ConnectionRow, "kind" | "id">) {
  switch (row.kind) {
    case "saml":
      return { to: "/auth/connections/saml/$id", params: { id: row.id } } as const;
    case "ldap":
      return { to: "/directory/connections/ldap/$id", params: { id: row.id } } as const;
    case "scim":
      return { to: "/directory/connections/scim" } as const;
    default:
      return { to: "/auth/connections/saml-idp" } as const;
  }
}

export type ConnectionsListPageProps = {
  filters: ConnectionListFilters;
  onFiltersChange: (next: ConnectionListFilters) => void;
};

/**
 * Authentication › Connections: every connection in one list. How people sign in from other
 * systems (SAML and LDAP), how they're kept in sync (SCIM), and the apps Qeet ID signs them in to
 * (SAML apps), each in one status word and opening its own page; the kinds not set up yet are
 * offered under the list, then the setup links. Directories › Connections shows the SCIM and LDAP
 * ones with their sync health.
 */
export function ConnectionsListPage({ filters, onFiltersChange }: ConnectionsListPageProps) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const navigate = useNavigate();
  const canWrite = useCapabilities().can("connection.write");
  const [sort, setSort] = useState<TableSort | null>({ column: "used", direction: "descending" });

  const samlQ = useSamlConnections();
  const ldapQ = useLdapConnections();
  const scimQ = useScimConfig();
  const appsQ = useSamlProviders();
  const directoryQ = useDirectoryConnections();
  // A directory connection with an open problem needs attention, however long ago it failed: the
  // directory's health turns "not checked" after a day without events.
  const openQ = useDirectoryErrors({
    days: 90,
    connection_id: "",
    severity: "",
    resolution: "open",
    q: "",
    limit: 100,
    offset: 0,
  });
  const linksQ = useAdminPortalLinks();
  const queries = [samlQ, ldapQ, scimQ, appsQ];
  const loaded = queries.every((q) => !!q.data);
  const failed = queries.find((q) => q.isError);
  const now = samlQ.dataUpdatedAt || Date.now();

  const rows = useMemo(() => {
    const failing = new Set([
      ...(directoryQ.data ?? [])
        .filter((c) => c.health === "failed" || c.health === "warning")
        .map((c) => c.id),
      ...(openQ.data?.items ?? []).map((e) => e.connection_id),
    ]);
    return connectionRows({
      saml: samlQ.data?.items ?? [],
      ldap: ldapQ.data?.items ?? [],
      scim: scimQ.data,
      apps: appsQ.data?.items ?? [],
      certificateEnds: (c) => readCertificate(c.idp_certificate)?.notAfter ?? null,
      failing,
      now,
    });
  }, [samlQ.data, ldapQ.data, scimQ.data, appsQ.data, directoryQ.data, openQ.data, now]);

  const nameOf = (row: ConnectionRow) => (row.kind === "scim" ? t("kinds.scim") : row.name);
  const matching = shownRows(rows, filters, nameOf);
  const shown = sort?.column === "used" ? byLastUsed(matching, sort.direction) : matching;

  const count = (test: (r: ConnectionRow) => boolean) => rows.filter(test).length;
  const scimSet = !!scimQ.data?.token_set;
  const activeLinks = (linksQ.data?.items ?? []).filter(
    (l) => setupLinkState(l, now) === "active",
  ).length;
  const missing = (
    [
      ["saml", !(samlQ.data?.items.length ?? 0)],
      ["ldap", !(ldapQ.data?.items.length ?? 0)],
      ["scim", !scimSet],
      ["app", !(appsQ.data?.items.length ?? 0)],
    ] as const
  )
    .filter(([, none]) => none)
    .map(([kind]) => kind);

  const newConnection = (kind: ConnectionKind) => {
    if (kind === "saml")
      void navigate({ to: "/auth/connections/saml", search: { action: "create" } });
    else if (kind === "ldap")
      void navigate({ to: "/directory/connections/ldap", search: { action: "create" } });
    else if (kind === "scim") void navigate({ to: "/directory/connections/scim" });
    else void navigate({ to: "/auth/connections/saml-idp", search: { action: "create" } });
  };

  const columns: TableColumn<ConnectionRow>[] = [
    {
      id: "name",
      header: t("list.columns.name"),
      primary: true,
      cell: (r) => (
        <span className="cx-name">
          <strong>{nameOf(r)}</strong>
          <small>{r.kind === "ldap" || r.kind === "scim" ? <code>{r.line}</code> : r.line}</small>
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
      width: 210,
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
                <MenuItem icon={ServerIcon} onClick={() => newConnection("ldap")}>
                  {t("kinds.ldap")}
                </MenuItem>
                <MenuItem
                  icon={NetworkIcon}
                  disabled={scimSet}
                  onClick={() => newConnection("scim")}
                >
                  {scimSet ? t("kinds.scimSet") : t("kinds.scim")}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={AppWindowIcon} onClick={() => newConnection("app")}>
                  {t("kinds.app")}
                </MenuItem>
              </MenuContent>
            </Menu>
          ) : undefined
        }
        summary={
          loaded ? (
            <ConnectionsBand
              rows={rows}
              links={activeLinks}
              people={scimQ.data?.provisioned_count}
              scimSet={scimSet}
            />
          ) : failed ? undefined : (
            <div className="ppl-band" aria-hidden="true">
              {[0, 1, 2, 3].map((cell) => (
                <div key={cell} className="ppl-cell">
                  <Skeleton className="ppl-skeleton-label" />
                  <Skeleton className="ppl-skeleton-value" />
                  <Skeleton lines={2} />
                </div>
              ))}
            </div>
          )
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
                rowLabel={nameOf}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={!loaded}
                renderRowLink={(r) => <Link {...pageOf(r)} />}
                toolbar={
                  <Toolbar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    counts={{
                      signin: count((r) => KIND_GROUP[r.kind] === "signin"),
                      provisioning: count((r) => KIND_GROUP[r.kind] === "provisioning"),
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
                    icon={NetworkIcon}
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
    </>
  );
}
