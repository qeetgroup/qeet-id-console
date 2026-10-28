import { MonitorSmartphoneIcon, SearchIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatNumber,
  MenuItem,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import {
  type AppliedFilter,
  AvatarItem,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useOidcClients } from "@/modules/authentication";
import { PageBreadcrumb, Sparkline } from "@/modules/dashboard";
import {
  type DeviceAuth,
  useDeviceAuthorizations,
  useRevokeDeviceAuth,
} from "@/modules/security/api/device-auth";
import {
  DEVICE_STATES,
  type DeviceFilters,
  type DeviceState,
  deviceState,
  matchesDevice,
  requestsPerDay,
} from "@/modules/security/device-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { BandPlaceholder } from "./band-placeholder";
import { When, whenText } from "./when";
import "./security.css";

const ANY = "";
// Each option's count is part of its label until Select items have a count of their own (QTRX-20).
const DAYS = 14;
const STATE_TONE = {
  waiting: "info",
  approved: "success",
  denied: "neutral",
  expired: "neutral",
} as const;

export type DevicesPageProps = {
  filters: DeviceFilters;
  onFiltersChange: (next: DeviceFilters) => void;
};

/**
 * Authentication › Device sign-ins: sign-ins from devices without a browser (RFC 8628). The device
 * shows a code; someone approves it on another screen; the device's next poll spends the code for
 * its tokens. What matters is what each request became. A waiting one can be denied; an approved
 * one can't be signed out from here yet (the server can't end the tokens a grant issued, a QTID
 * gap), so its row offers the approver's events in the audit log instead.
 */
export function DevicesPage({ filters, onFiltersChange }: DevicesPageProps) {
  const { t } = useTranslation("security");
  const canWrite = useCapabilities().can("connection.write");
  const list = useDeviceAuthorizations();
  const clients = useOidcClients();
  const revoke = useRevokeDeviceAuth();
  const runSensitive = useSensitiveAction();
  const items = list.data?.items ?? [];
  const now = list.dataUpdatedAt || Date.now();
  const rows = useMemo(
    () => items.filter((d) => matchesDevice(d, filters, now)),
    [items, filters, now],
  );
  const appName = useMemo(() => {
    const names = new Map((clients.data?.items ?? []).map((c) => [c.client_id, c.name]));
    return (clientId: string) => names.get(clientId) ?? clientId;
  }, [clients.data]);
  const filtered = !!(filters.q || filters.status || filters.app);

  const deny = (d: DeviceAuth) =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("devices.deny.title", { code: d.user_code }),
        description: t("devices.deny.description", {
          code: d.user_code,
          app: appName(d.client_id),
        }),
        confirmLabel: t("devices.deny.confirm"),
        tone: "destructive",
      },
      actionLabel: t("devices.deny.action"),
      run: () => revoke.mutateAsync(d.id),
    }).catch(settleSensitiveAction);

  const outcome = (d: DeviceAuth) => {
    const s = deviceState(d, now);
    if (s === "approved")
      return d.last_polled_at
        ? t("devices.outcome.approvedPolled", { when: whenText(d.last_polled_at, now) })
        : t("devices.outcome.approved");
    if (s === "denied") return t("devices.outcome.denied");
    if (s === "waiting")
      return t("devices.outcome.waiting", { when: whenText(d.expires_at, now, true) });
    return t("devices.outcome.expired", { when: whenText(d.expires_at, now) });
  };

  const columns: TableColumn<DeviceAuth>[] = [
    {
      id: "code",
      header: t("devices.columns.code"),
      primary: true,
      width: 132,
      cell: (d) => <span className="sec-code">{d.user_code}</span>,
    },
    {
      id: "status",
      header: t("devices.columns.status"),
      cell: (d) => {
        const s = deviceState(d, now);
        return (
          <span className="sec-two">
            <span>
              <Badge size="sm" tone={STATE_TONE[s]}>
                {t(`devices.state.${s}`)}
              </Badge>
            </span>
            <small>{outcome(d)}</small>
          </span>
        );
      },
    },
    {
      id: "person",
      header: t("devices.columns.person"),
      cell: (d) =>
        d.user_email ? <AvatarItem name={d.user_email} /> : <Text tone="subtle">—</Text>,
    },
    {
      id: "app",
      header: t("devices.columns.app"),
      cell: (d) => (
        <span className="sec-two">
          <strong>{appName(d.client_id)}</strong>
          <small>{d.scopes.join(" · ")}</small>
        </span>
      ),
    },
    {
      id: "requested",
      header: t("devices.columns.requested"),
      width: 144,
      cell: (d) => <When at={d.created_at} now={now} />,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("devices.title")}
        count={list.data ? items.length : undefined}
        description={t("devices.description")}
        summary={
          list.data ? (
            <DevicesBand items={items} now={now} appName={appName} />
          ) : list.isError ? undefined : (
            <BandPlaceholder />
          )
        }
      />
      <PageContent>
        <div className="ppl">
          {list.isError ? (
            <DataState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <Table<DeviceAuth>
              label={t("devices.title")}
              rows={rows}
              rowId={(d) => d.id}
              rowLabel={(d) => t("devices.rowLabel", { code: d.user_code })}
              columns={columns}
              loading={list.isLoading}
              toolbar={
                <DevicesToolbar
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  items={items}
                  shown={rows.length}
                  now={now}
                  appName={appName}
                />
              }
              // Library gap (new): Table can't leave a row without its actions menu, so every row
              // keeps one item (Open the application).
              rowActions={(d) => {
                const s = deviceState(d, now);
                return (
                  <>
                    {canWrite && s === "waiting" ? (
                      <MenuItem tone="danger" onClick={() => void deny(d)}>
                        {t("devices.deny.button")}
                      </MenuItem>
                    ) : null}
                    {d.user_id ? (
                      <MenuItem
                        render={
                          <Link to="/security/audit-logs" search={{ actor_user_id: d.user_id }} />
                        }
                      >
                        {t("devices.actions.events")}
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      render={
                        <Link
                          to="/auth/connections/oidc/$clientId"
                          params={{ clientId: d.client_id }}
                        />
                      }
                    >
                      {t("devices.actions.app")}
                    </MenuItem>
                  </>
                );
              }}
              empty={
                filtered ? (
                  <EmptyState
                    size="section"
                    icon={SearchIcon}
                    title={
                      filters.status === "waiting"
                        ? t("devices.empty.waitingTitle")
                        : t("devices.empty.filteredTitle")
                    }
                    description={
                      filters.status === "waiting"
                        ? t("devices.empty.waitingDescription")
                        : t("devices.empty.filteredDescription")
                    }
                    actions={
                      <Button variant="ghost" onClick={() => onFiltersChange({})}>
                        {t("devices.empty.everything")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    size="section"
                    icon={MonitorSmartphoneIcon}
                    title={t("devices.empty.title")}
                    description={t("devices.empty.description")}
                  />
                )
              }
            />
          )}
        </div>
      </PageContent>
    </>
  );
}

/** The key numbers: what's waiting now, what was approved and by how many people, the last two weeks, and by application. */
function DevicesBand({
  items,
  now,
  appName,
}: {
  items: readonly DeviceAuth[];
  now: number;
  appName: (clientId: string) => string;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const to = (search: DeviceFilters) => ({
    to: "/security/device-authorizations" as const,
    search,
  });
  const count = (s: DeviceState) => items.filter((d) => deviceState(d, now) === s).length;
  const approvers = new Set(
    items.filter((d) => deviceState(d, now) === "approved").map((d) => d.user_email),
  ).size;
  const days = requestsPerDay(items, now, DAYS);
  const recent = days.reduce((sum, d) => sum + d, 0);
  const apps = [...new Set(items.map((d) => d.client_id))]
    .map((id) => ({ id, count: items.filter((d) => d.client_id === id).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("devices.band.waiting")}</dt>
        <dd className="ppl-value">{n(count("waiting"))}</dd>
        <dd className="ppl-note">{t("devices.band.waitingNote")}</dd>
        {count("waiting") ? (
          <dd className="ppl-link">
            <Link {...to({ status: "waiting" })}>{t("devices.band.showWaiting")}</Link>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("devices.band.approved")}</dt>
        <dd className="ppl-value">{n(count("approved"))}</dd>
        <dd className="ppl-note">
          {t("devices.band.approvedNote", {
            people: n(approvers),
            denied: n(count("denied")),
            expired: n(count("expired")),
          })}
        </dd>
        {count("approved") ? (
          <dd className="ppl-link">
            <Link {...to({ status: "approved" })}>{t("devices.band.showApproved")}</Link>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("devices.band.recent", { days: DAYS })}</dt>
        <dd className="ppl-value">{n(recent)}</dd>
        <dd className="ppl-chart">
          <span role="img" aria-label={t("devices.band.chartLabel", { n: n(recent), days: DAYS })}>
            <Sparkline values={days} width={132} height={40} />
          </span>
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("devices.band.apps")}</dt>
        <dd className="ppl-looks">
          {apps.length ? (
            <ul>
              {apps.map((a) => (
                <li key={a.id}>
                  <Link {...to({ app: a.id })}>
                    <span>{appName(a.id)}</span>
                    <b>{n(a.count)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="ppl-note">{t("devices.band.noApps")}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function DevicesToolbar({
  filters,
  onFiltersChange,
  items,
  shown,
  now,
  appName,
}: {
  filters: DeviceFilters;
  onFiltersChange: (next: DeviceFilters) => void;
  items: readonly DeviceAuth[];
  shown: number;
  now: number;
  appName: (clientId: string) => string;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<DeviceFilters>) => onFiltersChange({ ...filters, ...patch });
  const apps = [...new Set(items.map((d) => d.client_id))];

  const tags: AppliedFilter[] = [];
  if (filters.status)
    tags.push({
      id: "status",
      label: t("devices.filters.status"),
      value: t(`devices.state.${filters.status}`),
    });
  if (filters.app)
    tags.push({ id: "app", label: t("devices.filters.app"), value: appName(filters.app) });

  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("devices.filters.search")}
          placeholder={t("devices.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("devices.filters.status")}
          className="ppl-filter"
          value={filters.status ?? ANY}
          onValueChange={(value) => set({ status: DEVICE_STATES.find((s) => s === value) })}
          items={[
            { value: ANY, label: t("devices.filters.anyStatus") },
            ...DEVICE_STATES.map((s) => ({
              value: s,
              label: `${t(`devices.state.${s}`)} · ${n(items.filter((d) => deviceState(d, now) === s).length)}`,
            })),
          ]}
        />
        {apps.length > 1 || filters.app ? (
          <Select
            aria-label={t("devices.filters.app")}
            className="ppl-filter"
            value={filters.app ?? ANY}
            onValueChange={(value) => set({ app: value ? String(value) : undefined })}
            items={[
              { value: ANY, label: t("devices.filters.anyApp") },
              ...apps.map((id) => ({
                value: id,
                label: `${appName(id)} · ${n(items.filter((d) => d.client_id === id).length)}`,
              })),
            ]}
          />
        ) : null}
      </div>
      {/* Only once something narrows the list (FilterTags shows its summary even with none,
          QTRX-15). */}
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("devices.filters.summary", { n: n(shown), total: n(items.length) })}
        />
      ) : null}
    </div>
  );
}
