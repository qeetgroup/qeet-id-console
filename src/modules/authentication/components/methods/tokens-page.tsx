import { KeyRoundIcon } from "@qeetrix/icons";
import {
  formatNumber,
  MenuItem,
  MenuSeparator,
  Table,
  type TableColumn,
  type TableSort,
} from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
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
import { type AppTokens, byApplication, sortApplications } from "./grants-model";
import { useGrantRows } from "./use-grant-rows";
import { When } from "./methods-parts";
import { useRevokeGrants } from "./use-revoke-grants";
import "./methods.css";

/**
 * Developer › Tokens: the same refresh tokens as Applications › OAuth grants (one endpoint), by
 * the application that holds them: how many, for how many people, and Revoke all for an
 * application that's retired or compromised. One person's grants are revoked on OAuth grants.
 */
export function TokensPage() {
  const { t } = useTranslation("authentication");
  const access = useCapabilities();
  const canRevoke = access.can("connection.write");
  const runSensitive = useSensitiveAction();
  const revoke = useRevokeGrants();
  const { grants, rows, clients } = useGrantRows({ withPeople: false });
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const [sort, setSort] = useState<TableSort | null>(null);
  const apps = useMemo(() => sortApplications(byApplication(rows), sort), [rows, sort]);
  // Applications people haven't been kept signed in to hold none.
  const without = clients
    ? clients.filter((c) => !apps.some((a) => a.client_id === c.client_id)).length
    : 0;

  const revokeAll = (app: AppTokens) =>
    runSensitive({
      confirm: {
        title: t("tokens.revokeTitle", { count: app.grants.length, app: app.name }),
        description: t("tokens.revokeDescription", { count: app.people, app: app.name }),
        confirmLabel: t("tokens.revokeConfirm"),
        tone: "destructive",
      },
      actionLabel: t("tokens.revokeAction", { app: app.name }),
      run: () => revoke.mutateAsync(app.grants.map((g) => g.id)),
    })
      .then((res) => {
        if (!res) return;
        if (res.failed) toast.error(t("tokens.someFailed", { count: res.failed }));
        else toast.success(t("tokens.revoked", { count: res.revoked, app: app.name }));
      })
      .catch(settleSensitiveAction);

  const columns: TableColumn<AppTokens>[] = [
    {
      id: "app",
      header: t("tokens.columns.app"),
      primary: true,
      sortable: true,
      cell: (a) => (
        <span className="am-cell">
          <span>{a.name}</span>
          {a.name !== a.client_id && <small className="account-mono">{a.client_id}</small>}
        </span>
      ),
    },
    {
      id: "type",
      header: t("tokens.columns.type"),
      cell: (a) => (a.type ? t(`tokens.types.${a.type}`) : "—"),
    },
    {
      id: "tokens",
      header: t("tokens.columns.tokens"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      cell: (a) => n(a.grants.length),
    },
    {
      id: "people",
      header: t("tokens.columns.people"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      cell: (a) => n(a.people),
    },
    {
      id: "renewed",
      header: t("tokens.columns.renewed"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      cell: (a) => (
        <span className="am-nowrap">
          <When iso={a.renewed} />
        </span>
      ),
    },
    {
      id: "ends",
      header: t("tokens.columns.nextEnd"),
      numeric: true,
      cell: (a) => (
        <span className="am-nowrap">
          <When iso={a.nextEnd} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("tokens.title")}
        count={grants.data ? rows.length : undefined}
        description={t("tokens.description")}
      />
      <PageContent>
        <div className="am-list">
          {grants.isError ? (
            <DataState error={grants.error} onRetry={() => grants.refetch()} />
          ) : (
            <Table<AppTokens>
              label={t("tokens.tableLabel")}
              rows={apps}
              rowId={(a) => a.client_id}
              rowLabel={(a) => a.name}
              columns={columns}
              sort={sort}
              onSortChange={setSort}
              loading={grants.isLoading}
              rowActions={(a) => (
                <>
                  <MenuItem
                    render={<Link to="/auth/api/consent-grants" search={{ app: a.client_id }} />}
                  >
                    {t("tokens.seeGrants", { count: a.grants.length })}
                  </MenuItem>
                  {a.type && (
                    <MenuItem
                      render={
                        <Link
                          to="/auth/connections/oidc/$clientId"
                          params={{ clientId: a.client_id }}
                        />
                      }
                    >
                      {t("tokens.openApp", { app: a.name })}
                    </MenuItem>
                  )}
                  {canRevoke && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        tone="danger"
                        disabled={revoke.isPending}
                        onClick={() => void revokeAll(a)}
                      >
                        {t("tokens.revokeAll", { count: a.grants.length })}
                      </MenuItem>
                    </>
                  )}
                </>
              )}
              empty={
                <EmptyState
                  size="section"
                  icon={KeyRoundIcon}
                  title={t("tokens.emptyTitle")}
                  description={t("tokens.emptyDescription")}
                />
              }
            />
          )}
          {revoke.progress && (
            <p className="account-note" role="status">
              {t("tokens.progress", revoke.progress)}
            </p>
          )}
          {grants.data && (
            <p className="account-note">
              {without > 0
                ? `${t("tokens.accessNote")} ${t("tokens.withoutNote", { count: without })}`
                : t("tokens.accessNote")}{" "}
              {t("tokens.grantsBefore")}{" "}
              <Link to="/auth/api/consent-grants">{t("tokens.grantsLink")}</Link>
              {t("tokens.grantsAfter")}
            </p>
          )}
        </div>
      </PageContent>
    </>
  );
}
