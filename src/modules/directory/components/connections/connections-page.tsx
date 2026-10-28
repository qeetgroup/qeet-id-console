import { EyeIcon, NetworkIcon, PlusIcon, ServerIcon, WorkflowIcon } from "@qeetrix/icons";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, Table } from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
} from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  DEFAULT_ERROR_FILTERS,
  DEFAULT_EVENT_FILTERS,
  useDirectoryConnections,
  useDirectoryErrors,
} from "@/modules/directory/api/directory";
import { useDirectoryEvents } from "@/modules/directory/api/events";
import {
  DAYS,
  latestProblems,
  missingKinds,
  shownConnection,
} from "@/modules/directory/connections-model";
import type { ConnectionsFilters } from "@/modules/directory/connections-search";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { useConnectionActions } from "@/modules/directory/use-connection-actions";
import { useUserStats } from "@/modules/users";
import { useCapabilities } from "@/platform/security/capability-provider";
import { BandPlaceholder } from "../band-placeholder";
import { ConnectionsBand } from "./connections-band";
import { ConnectionOffers, ConnectionRowMenu, useConnectionColumns } from "./connections-table";
import "./connections.css";

const NO_CONNECTIONS: DirectoryConnection[] = [];

export type ConnectionsPageProps = {
  /** What the address narrows the list to. */
  filters: ConnectionsFilters;
  onFiltersChange: (next: ConnectionsFilters) => void;
};

/**
 * Directory › Directories › Connections: where the organisation's people come from. One list of
 * its directory connections, its SCIM endpoint and its LDAP servers, each opening its own page; the
 * header's band says where people come from, how the connections are, the last 30 days, and what
 * needs a look. A kind not set up yet is offered under the table.
 */
export function ConnectionsPage({ filters, onFiltersChange }: ConnectionsPageProps) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const access = useCapabilities();
  const canWrite = access.can("connection.write");

  const connectionsQ = useDirectoryConnections();
  const connections = connectionsQ.data ?? NO_CONNECTIONS;
  const peopleQ = useUserStats(access.can("user.read"));
  // The month in two reads: its summary and volume, and its failures (a short list) to mark days.
  const monthQ = useDirectoryEvents({ ...DEFAULT_EVENT_FILTERS, days: DAYS, limit: 1 });
  const failedQ = useDirectoryEvents({
    ...DEFAULT_EVENT_FILTERS,
    days: DAYS,
    status: "failed",
    limit: 100,
  });
  const openQ = useDirectoryErrors({
    ...DEFAULT_ERROR_FILTERS,
    days: 90,
    resolution: "open",
    limit: 100,
  });
  const actions = useConnectionActions();
  const now = connectionsQ.dataUpdatedAt || Date.now();

  const problems = useMemo(() => latestProblems(openQ.data?.items ?? []), [openQ.data]);
  const columns = useConnectionColumns({ problems, now });
  const rows = connections.filter((c) => shownConnection(c, filters));
  const scimSet = connections.some((c) => c.type === "scim");
  const openErrors = openQ.data?.summary.open ?? 0;
  const loaded = !!connectionsQ.data && !!monthQ.data;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("connections.title")}
        count={connectionsQ.data ? connections.length : undefined}
        description={t("connections.description")}
        actions={
          canWrite ? (
            <Menu>
              <MenuTrigger render={<Button icon={PlusIcon}>{t("connections.add")}</Button>} />
              <MenuContent align="end">
                {/* A second line for each kind waits for MenuItem descriptions (QTRX-50); the
                    offers under the table say what each does. */}
                <MenuItem
                  icon={WorkflowIcon}
                  disabled={scimSet}
                  onClick={() => void navigate({ to: "/directory/connections/scim" })}
                >
                  {scimSet ? t("connections.addScimSet") : t("connections.kinds.scim")}
                </MenuItem>
                <MenuItem
                  icon={ServerIcon}
                  onClick={() => void navigate({ to: "/directory/connections/ldap" })}
                >
                  {t("connections.kinds.ldap")}
                </MenuItem>
              </MenuContent>
            </Menu>
          ) : undefined
        }
        summary={
          loaded ? (
            <ConnectionsBand
              connections={connections}
              people={peopleQ.data?.total}
              volume={monthQ.data?.volume ?? []}
              failed={failedQ.data?.items ?? []}
              totalEvents={monthQ.data?.summary.total ?? 0}
              openErrors={openErrors}
              now={now}
            />
          ) : connectionsQ.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={
          <PageTabs>
            <PageTabList badges={{ "/directory/sync-errors": openErrors }} />
          </PageTabs>
        }
      />
      <PageContent>
        <div className="ppl dir">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("connections.readOnly.title")}>
              {t("connections.readOnly.description")}
            </Alert>
          ) : null}
          {connectionsQ.isError ? (
            <DataState error={connectionsQ.error} onRetry={() => connectionsQ.refetch()} />
          ) : (
            <>
              {filters.show ? (
                <FilterTags
                  filters={[
                    {
                      id: "show",
                      label: t("connections.band.needsALook"),
                      value: t(`connections.show.${filters.show}`),
                    },
                  ]}
                  onRemove={() => onFiltersChange({})}
                  onClear={() => onFiltersChange({})}
                  summary={t("connections.shown", { n: rows.length, total: connections.length })}
                />
              ) : null}
              {connections.length || connectionsQ.isLoading ? (
                <Table<DirectoryConnection>
                  label={t("connections.title")}
                  rows={rows}
                  rowId={(c) => c.id}
                  rowLabel={(c) => (c.type === "scim" ? t("connections.kinds.scim") : c.name)}
                  columns={columns}
                  loading={connectionsQ.isLoading}
                  rowActions={(c) => (
                    <ConnectionRowMenu
                      connection={c}
                      canWrite={canWrite}
                      onTest={(row) => void actions.test(row)}
                      onSetOn={(row, on) => void actions.setOn(row, on)}
                      onDelete={(row) => void actions.remove(row)}
                      onRevoke={(row) => void actions.revoke(row)}
                    />
                  )}
                  empty={
                    <EmptyState
                      size="section"
                      icon={NetworkIcon}
                      title={t("connections.emptyFiltered.title")}
                      description={t("connections.emptyFiltered.description")}
                      actions={
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("connections.emptyFiltered.clear")}
                        </Button>
                      }
                    />
                  }
                />
              ) : null}
              {connectionsQ.data ? (
                <ConnectionOffers kinds={missingKinds(connections)} canWrite={canWrite} />
              ) : null}
            </>
          )}
        </div>
      </PageContent>
    </>
  );
}
