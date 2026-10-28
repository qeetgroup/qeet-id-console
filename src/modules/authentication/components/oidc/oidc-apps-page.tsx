import { AppWindowIcon, ArrowRightIcon, CopyIcon, PlusIcon, TrashIcon } from "@qeetrix/icons";
import {
  Button,
  formatDate,
  formatDateTime,
  formatNumber,
  MenuItem,
  MenuSeparator,
  Select,
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
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { useOAuthGrants } from "@/modules/authentication/api/oauth-grants";
import {
  type OidcClient,
  useDeleteOidcClient,
  useOidcClients,
} from "@/modules/authentication/api/oidc-clients";
import {
  APP_KINDS,
  type AppFilters,
  appKind,
  appStatus,
  peopleByClient,
  shownApps,
  signsInAt,
} from "@/modules/authentication/oidc-apps-model";
import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { AppStatusBadge } from "./app-status-badge";
import { OidcAppDrawer } from "./oidc-app-drawer";
import "@/modules/authentication/components/connections/connections.css";

const PAGE_SIZES = [25, 50, 100] as const;
const ANY = "";

export type OidcAppsPageProps = {
  filters: AppFilters & { look?: "pkce" | "localhost" };
  onFiltersChange: (next: AppFilters & { look?: "pkce" | "localhost" }) => void;
  /** Register application asked for (`?action=create`). */
  registering: boolean;
  onRegisteringChange: (open: boolean) => void;
};

/**
 * Applications: the apps that sign people in with Qeet ID (OpenID Connect). Each row says what
 * kind of app it is, where it signs people in, its one status (an exemption from the proof key,
 * every address on this computer, or active) and how many people are signed in to it now; a name
 * opens its page. Bulk delete and export are gone (redesign-findings, Connections).
 */
export function OidcAppsPage({
  filters,
  onFiltersChange,
  registering,
  onRegisteringChange,
}: OidcAppsPageProps) {
  const { t } = useTranslation("oidc");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const navigate = useNavigate();
  const canWrite = useCapabilities().can("connection.write");
  const runSensitive = useSensitiveAction();
  const listQ = useOidcClients();
  const grantsQ = useOAuthGrants();
  const deleteM = useDeleteOidcClient();
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);

  const clients = listQ.data?.items ?? [];
  const people = useMemo(() => peopleByClient(grantsQ.data?.items ?? []), [grantsQ.data]);
  const now = new Date(listQ.dataUpdatedAt || Date.now());
  const peopleIn = (c: OidcClient) => people.get(c.client_id) ?? 0;
  const looks = {
    pkce: clients.filter((c) => {
      const s = appStatus(c, now).kind;
      return s === "pkceExempt" || s === "pkceEnded";
    }),
    localhost: clients.filter((c) => appStatus(c, now).kind === "localhost"),
  };
  const matching = shownApps(filters.look ? looks[filters.look] : clients, filters);
  const sorted = sortApps(matching, sort, peopleIn);
  const start = offset < sorted.length ? offset : 0;
  const onPage = sorted.slice(start, start + pageSize);
  const change = (next: OidcAppsPageProps["filters"]) => {
    setOffset(0);
    onFiltersChange(next);
  };
  const signedIn = new Set((grantsQ.data?.items ?? []).map((g) => g.user_id)).size;

  const remove = (c: OidcClient) =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("delete.title", { name: c.name }),
        description: t("delete.description", { name: c.name }),
        confirmLabel: t("delete.confirm"),
        tone: "destructive",
      },
      actionLabel: t("delete.action"),
      run: () => deleteM.mutateAsync(c.id),
    }).catch(settleSensitiveAction);

  const columns: TableColumn<OidcClient>[] = [
    {
      id: "name",
      header: t("list.columns.name"),
      primary: true,
      sortable: true,
      cell: (c) => (
        <span className="cx-name">
          <strong>{c.name}</strong>
          <small>
            <code>{c.client_id}</code>
          </small>
        </span>
      ),
    },
    {
      id: "type",
      header: t("list.columns.type"),
      width: 150,
      cell: (c) => (
        <span className="cx-name">
          <span>{t(`kinds.${appKind(c)}`)}</span>
          <small>{c.type === "confidential" ? t("type.confidential") : t("type.public")}</small>
        </span>
      ),
    },
    {
      id: "at",
      header: t("list.columns.signsInAt"),
      width: 200,
      cell: (c) => {
        const at = signsInAt(c);
        return at ? (
          <span className="cx-name">
            <span>{at}</span>
          </span>
        ) : (
          <Text tone="subtle">
            {appKind(c) === "cli" ? t("list.noRedirectDevice") : t("list.noRedirect")}
          </Text>
        );
      },
    },
    {
      id: "status",
      header: t("list.columns.status"),
      width: 150,
      cell: (c) => <AppStatusBadge status={appStatus(c, now)} />,
    },
    {
      id: "people",
      header: t("list.columns.people"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      width: 110,
      cell: (c) => (grantsQ.data ? n(peopleIn(c)) : <Text tone="subtle">—</Text>),
    },
    {
      id: "created",
      header: t("list.columns.created"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      width: 120,
      cell: (c) => (
        <time
          className="cx-nowrap"
          dateTime={c.created_at}
          title={formatDateTime(c.created_at, locale)}
        >
          {formatDate(c.created_at, locale, { dateStyle: "medium" })}
        </time>
      ),
    },
  ];

  const tags: AppliedFilter[] = [];
  if (filters.look)
    tags.push({ id: "look", label: t("band.needsALook"), value: t(`list.look.${filters.look}`) });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("list.title")}
        count={listQ.data ? clients.length : undefined}
        description={t("list.description")}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => onRegisteringChange(true)}>
              {t("list.register")}
            </Button>
          ) : undefined
        }
        summary={
          listQ.data ? (
            <dl className="ppl-band is-three">
              <div className="ppl-cell">
                <dt className="ppl-label">{t("band.apps")}</dt>
                <dd className="ppl-value">{n(clients.length)}</dd>
                <dd className="ppl-note">
                  {t("band.appsNote", {
                    confidential: n(clients.filter((c) => c.type === "confidential").length),
                    public: n(clients.filter((c) => c.type === "public").length),
                  })}
                </dd>
              </div>
              <div className="ppl-cell">
                <dt className="ppl-label">{t("band.signedIn")}</dt>
                <dd className="ppl-value">{grantsQ.data ? n(signedIn) : "—"}</dd>
                <dd className="ppl-note">{t("band.signedInNote")}</dd>
                {canWrite || grantsQ.data ? (
                  <dd className="ppl-link">
                    <Link to="/auth/api/consent-grants">{t("band.grants")}</Link>
                  </dd>
                ) : null}
              </div>
              <div className="ppl-cell">
                <dt className="ppl-label">{t("band.needsALook")}</dt>
                <dd className="ppl-looks">
                  <ul>
                    {(["pkce", "localhost"] as const).map((look) => (
                      <li key={look} className={looks[look].length ? undefined : "is-zero"}>
                        <Link to="/auth/connections/oidc" search={{ look }}>
                          <span>{t(`list.look.${look}`)}</span>
                          <b
                            className={
                              look === "pkce" && looks.pkce.length ? "is-warning" : undefined
                            }
                          >
                            {n(looks[look].length)}
                          </b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          ) : listQ.isError ? undefined : (
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
      />
      <PageContent>
        <div className="ppl">
          {listQ.isError ? (
            <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
          ) : (
            <>
              {tags.length ? (
                <FilterTags
                  filters={tags}
                  onRemove={() => change({ ...filters, look: undefined })}
                  onClear={() => change({})}
                  summary={t("list.shown", { n: n(sorted.length), total: n(clients.length) })}
                />
              ) : null}
              <Table<OidcClient>
                label={t("list.title")}
                rows={onPage}
                rowId={(c) => c.id}
                rowLabel={(c) => c.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={listQ.isLoading}
                renderRowLink={(c) => (
                  <Link to="/auth/connections/oidc/$clientId" params={{ clientId: c.client_id }} />
                )}
                toolbar={
                  <AppsToolbar filters={filters} onFiltersChange={change} clients={clients} />
                }
                rowActions={(c) => (
                  <>
                    <MenuItem
                      icon={ArrowRightIcon}
                      onClick={() =>
                        void navigate({
                          to: "/auth/connections/oidc/$clientId",
                          params: { clientId: c.client_id },
                        })
                      }
                    >
                      {t("list.actions.open")}
                    </MenuItem>
                    <MenuItem
                      icon={CopyIcon}
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(c.client_id)
                          .then(() => toast.success(t("list.actions.copied")))
                      }
                    >
                      {t("list.actions.copy")}
                    </MenuItem>
                    {canWrite ? (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={TrashIcon} tone="danger" onClick={() => void remove(c)}>
                          {t("list.actions.delete")}
                        </MenuItem>
                      </>
                    ) : null}
                  </>
                )}
                empty={
                  <EmptyState
                    size="section"
                    icon={AppWindowIcon}
                    title={clients.length ? t("list.emptyFiltered.title") : t("list.empty.title")}
                    description={
                      clients.length
                        ? t("list.emptyFiltered.description")
                        : t("list.empty.description")
                    }
                    actions={
                      clients.length ? (
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("list.emptyFiltered.clear")}
                        </Button>
                      ) : canWrite ? (
                        <Button
                          variant="soft"
                          tone="neutral"
                          icon={PlusIcon}
                          onClick={() => onRegisteringChange(true)}
                        >
                          {t("list.register")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              {sorted.length > PAGE_SIZES[0] ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={sorted.length}
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
      <OidcAppDrawer open={registering} onOpenChange={onRegisteringChange} />
    </>
  );
}

function sortApps(rows: OidcClient[], sort: TableSort | null, people: (c: OidcClient) => number) {
  if (!sort) return rows;
  const dir = sort.direction === "ascending" ? 1 : -1;
  const by =
    sort.column === "name"
      ? (a: OidcClient, b: OidcClient) => a.name.localeCompare(b.name)
      : sort.column === "people"
        ? (a: OidcClient, b: OidcClient) => people(a) - people(b)
        : (a: OidcClient, b: OidcClient) => Date.parse(a.created_at) - Date.parse(b.created_at);
  return [...rows].sort((a, b) => by(a, b) * dir);
}

/** Search on name and client ID, then the kind of app, each kind with its count (QTRX-20). */
function AppsToolbar({
  filters,
  onFiltersChange,
  clients,
}: {
  filters: OidcAppsPageProps["filters"];
  onFiltersChange: (next: OidcAppsPageProps["filters"]) => void;
  clients: OidcClient[];
}) {
  const { t } = useTranslation("oidc");
  const n = (value: number) => formatNumber(value, formatLocale());
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          className="ppl-search"
          aria-label={t("list.search")}
          placeholder={t("list.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => onFiltersChange({ ...filters, q: q.trim() || undefined })}
        />
        <Select<string>
          aria-label={t("list.columns.type")}
          className="ppl-filter"
          value={filters.kind ?? ANY}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, kind: (value || undefined) as AppFilters["kind"] })
          }
          items={[
            { value: ANY, label: t("list.anyKind") },
            ...APP_KINDS.filter((k) => clients.some((c) => appKind(c) === k)).map((k) => ({
              value: k,
              label: `${t(`kinds.${k}`)} · ${n(clients.filter((c) => appKind(c) === k).length)}`,
            })),
          ]}
        />
      </div>
    </div>
  );
}
