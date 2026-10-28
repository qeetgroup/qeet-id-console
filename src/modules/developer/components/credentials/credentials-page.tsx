import {
  BadgeCheckIcon,
  CopyIcon,
  EyeIcon,
  FileCheckIcon,
  PlusIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Badge,
  type BadgeTone,
  Button,
  MenuItem,
  MenuSeparator,
  Select,
  Table,
  type TableSort,
} from "@qeetrix/react";
import {
  Alert,
  type AppliedFilter,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb, Sparkline } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import {
  type Credential,
  useCredentials,
  useRevokeCredential,
} from "@/modules/developer/api/credentials";
import { createdByMonth, datedStatus } from "@/modules/developer/machine-model";
import { BandCount, BandLooks, BandPlaceholder, BandSplit, useNumbers, When } from "../parts";
import { IssueDrawer, VerifyDrawer } from "./credential-drawers";
import "../developer.css";

const PAGE_SIZES = [25, 50, 100] as const;
const MONTHS = 15;
const ANY = "";
export const VC_STATUSES = ["active", "expiring", "expired", "revoked"] as const;
export type VcStatus = (typeof VC_STATUSES)[number];
export type CredentialFilters = { q?: string; type?: string; status?: VcStatus; look?: "noExpiry" };
const STATUS_COLOR: Record<VcStatus, string> = {
  active: "var(--qx-color-dataviz-positive)",
  expiring: "var(--qx-color-dataviz-warning)",
  expired: "var(--qx-color-dataviz-negative)",
  revoked: "var(--ppl-never)",
};

const statusOf = (c: Credential, now: number) =>
  datedStatus(c.revoked ? "revoked" : null, c.expires_at, now) as VcStatus;

/**
 * Developer › Verifiable credentials: signed statements about people (their employment, say) that
 * anyone can check against Qeet ID's public keys. Issuing shows the credential once; the server
 * keeps that it was issued, not the credential. Revoking makes every later check fail.
 */
export function CredentialsPage({
  filters,
  onFiltersChange,
}: {
  filters: CredentialFilters;
  onFiltersChange: (next: CredentialFilters) => void;
}) {
  const { t } = useTranslation(["developer", "common"]);
  const { n } = useNumbers();
  const access = useCapabilities();
  const canWrite = access.can("secret.write");
  const runSensitive = useSensitiveAction();
  const credentialsQ = useCredentials();
  const revokeM = useRevokeCredential();
  const [issuing, setIssuing] = useCreateIntent(canWrite);
  const [verifying, setVerifying] = useState(false);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const all = useMemo(() => credentialsQ.data?.items ?? [], [credentialsQ.data]);
  const now = credentialsQ.dataUpdatedAt || Date.now();
  const types = [...new Set(all.map((c) => c.type))].sort();
  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    const out = all.filter(
      (c) =>
        (!filters.type || c.type === filters.type) &&
        (!filters.status || statusOf(c, now) === filters.status) &&
        (!filters.look || (!c.expires_at && !c.revoked)) &&
        (!q || `${c.subject} ${c.type} ${c.id}`.toLowerCase().includes(q)),
    );
    const dir = sort?.direction === "descending" ? -1 : 1;
    const time = (iso?: string | null) => (iso ? Date.parse(iso) : Number.MAX_SAFE_INTEGER);
    const by: Record<string, (a: Credential, b: Credential) => number> = {
      type: (a, b) => a.type.localeCompare(b.type),
      issued: (a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at),
      expires: (a, b) => time(a.expires_at) - time(b.expires_at),
    };
    const compare = sort ? by[sort.column] : undefined;
    return compare ? [...out].sort((a, b) => compare(a, b) * dir) : out;
  }, [all, filters, now, sort]);
  const start = offset < rows.length ? offset : 0;
  const onPage = rows.slice(start, start + pageSize);
  const change = (next: CredentialFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };
  const set = (patch: Partial<CredentialFilters>) => change({ ...filters, ...patch });
  const to = (search: CredentialFilters) => ({ to: "/developer/credentials", search });
  const counts = VC_STATUSES.map((id) => ({
    id,
    count: all.filter((c) => statusOf(c, now) === id).length,
  }));
  const typeCounts = types
    .map((type) => ({ type, count: all.filter((c) => c.type === type).length }))
    .sort((a, b) => b.count - a.count);
  const months = createdByMonth(
    all.map((c) => c.issued_at),
    now,
    MONTHS,
  );

  const revoke = (c: Credential) =>
    void runSensitive({
      confirm: {
        title: t("credentials.revoke.title", { type: c.type }),
        description: t("credentials.revoke.description", { subject: c.subject }),
        confirmLabel: t("credentials.revoke.confirm"),
        tone: "destructive",
      },
      capability: "secret.write",
      actionLabel: t("credentials.revoke.action"),
      run: () => revokeM.mutateAsync(c.id),
    }).catch(settleSensitiveAction);
  const copyId = (c: Credential) =>
    void navigator.clipboard
      .writeText(c.id)
      .then(() => toast.success(t("machine.actions.copied")))
      .catch(() => toast.error(t("machine.actions.copyFailed")));

  const tags: AppliedFilter[] = [];
  if (filters.type)
    tags.push({ id: "type", label: t("credentials.columns.type"), value: filters.type });
  if (filters.status)
    tags.push({
      id: "status",
      label: t("machine.filters.status"),
      value: t(`credentials.status.${filters.status}`),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("machine.band.needsALook"),
      value: t("credentials.looks.noExpiry"),
    });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("credentials.title")}
        count={credentialsQ.data ? all.length : undefined}
        description={t("credentials.description")}
        actions={
          <>
            <Button variant="soft" icon={FileCheckIcon} onClick={() => setVerifying(true)}>
              {t("credentials.verify.open")}
            </Button>
            {canWrite ? (
              <Button icon={PlusIcon} onClick={() => setIssuing(true)}>
                {t("credentials.issue.open")}
              </Button>
            ) : null}
          </>
        }
        summary={
          credentialsQ.isError ? undefined : !credentialsQ.data ? (
            <BandPlaceholder cells={4} />
          ) : (
            <dl className="ppl-band">
              <BandCount
                label={t("credentials.band.valid")}
                value={n((counts[0]?.count ?? 0) + (counts[1]?.count ?? 0))}
                note={t("credentials.band.validNote", { total: n(all.length) })}
                chart={
                  <>
                    <span
                      role="img"
                      aria-label={t("credentials.band.growthLabel", { months: MONTHS })}
                    >
                      <Sparkline values={months} width={132} height={40} />
                    </span>
                    <span className="ppl-chart-caption" aria-hidden="true">
                      {t("credentials.band.months", { months: MONTHS })}
                    </span>
                  </>
                }
              />
              <BandSplit
                label={t("credentials.band.status")}
                parts={counts.map((p) => ({
                  ...p,
                  label: t(`credentials.status.${p.id}`),
                  color: STATUS_COLOR[p.id],
                  link: to({ status: p.id }),
                }))}
              />
              <BandSplit
                label={t("credentials.band.types")}
                parts={typeCounts.slice(0, 4).map((p, i) => ({
                  id: p.type,
                  count: p.count,
                  label: p.type,
                  color: `var(--qx-color-dataviz-categorical-${i + 1})`,
                  link: to({ type: p.type }),
                }))}
              />
              <BandLooks
                label={t("machine.band.needsALook")}
                looks={[
                  {
                    id: "expiring",
                    label: t("credentials.looks.expiring"),
                    count: counts[1]?.count ?? 0,
                    link: to({ status: "expiring" }),
                  },
                  {
                    id: "noExpiry",
                    label: t("credentials.looks.noExpiry"),
                    count: all.filter((c) => !c.expires_at && !c.revoked).length,
                    link: to({ look: "noExpiry" }),
                  },
                ]}
              />
            </dl>
          )
        }
      />
      <PageContent>
        <div className="ppl dev-page">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {credentialsQ.isError ? (
            <DataState error={credentialsQ.error} onRetry={() => void credentialsQ.refetch()} />
          ) : (
            <>
              <Table<Credential>
                label={t("credentials.title")}
                rows={onPage}
                rowId={(c) => c.id}
                rowLabel={(c) => t("credentials.rowLabel", { type: c.type, subject: c.subject })}
                sort={sort}
                onSortChange={setSort}
                loading={credentialsQ.isLoading}
                columns={[
                  {
                    id: "type",
                    header: t("credentials.columns.type"),
                    primary: true,
                    sortable: true,
                    cell: (c) => (
                      <span className="dev-name">
                        <strong>{c.type}</strong>
                        <span className="dev-ident">
                          <code title={c.id}>{c.id.slice(0, 8)}…</code>
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: "subject",
                    header: t("credentials.columns.subject"),
                    cell: (c) => <code className="dev-code dev-wrap">{c.subject}</code>,
                  },
                  {
                    id: "issued",
                    header: t("credentials.columns.issued"),
                    sortable: true,
                    sortFirst: "descending",
                    width: 140,
                    cell: (c) => <When at={c.issued_at} now={now} />,
                  },
                  {
                    id: "expires",
                    header: t("credentials.columns.expires"),
                    sortable: true,
                    width: 140,
                    cell: (c) => <When at={c.expires_at} now={now} none={t("machine.row.never")} />,
                  },
                  {
                    id: "status",
                    header: t("credentials.columns.status"),
                    width: 128,
                    cell: (c) => <VcBadge status={statusOf(c, now)} />,
                  },
                ]}
                toolbar={
                  all.length ? (
                    <div className="ppl-toolbar">
                      <div className="ppl-filters">
                        <SearchField
                          ref={searchRef}
                          className="ppl-search"
                          aria-label={t("credentials.search")}
                          placeholder={t("credentials.search")}
                          value={text}
                          onValueChange={setText}
                          onSearch={(q) => set({ q: q.trim() || undefined })}
                        />
                        {types.length > 1 ? (
                          <Select
                            aria-label={t("credentials.columns.type")}
                            className="ppl-filter"
                            value={filters.type ?? ANY}
                            onValueChange={(v) => set({ type: v ? String(v) : undefined })}
                            items={[
                              { value: ANY, label: t("credentials.anyType") },
                              ...typeCounts.map((p) => ({
                                value: p.type,
                                label: `${p.type} · ${n(p.count)}`,
                              })),
                            ]}
                          />
                        ) : null}
                        <Select
                          aria-label={t("machine.filters.status")}
                          className="ppl-filter"
                          value={filters.status ?? ANY}
                          onValueChange={(v) =>
                            set({ status: v ? (String(v) as VcStatus) : undefined })
                          }
                          items={[
                            { value: ANY, label: t("machine.filters.anyStatus") },
                            ...counts.map((p) => ({
                              value: p.id,
                              label: `${t(`credentials.status.${p.id}`)} · ${n(p.count)}`,
                            })),
                          ]}
                        />
                      </div>
                      {tags.length || filters.q ? (
                        <FilterTags
                          filters={tags}
                          onRemove={(id) => set({ [id]: undefined })}
                          onClear={() => change({ q: filters.q })}
                          returnFocusTo={searchRef}
                          summary={t("machine.filters.summary", {
                            n: n(rows.length),
                            total: n(all.length),
                          })}
                        />
                      ) : null}
                    </div>
                  ) : undefined
                }
                rowActions={(c) => (
                  <>
                    <MenuItem icon={CopyIcon} onClick={() => copyId(c)}>
                      {t("credentials.copyId")}
                    </MenuItem>
                    {canWrite && !c.revoked ? (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={TrashIcon} tone="danger" onClick={() => revoke(c)}>
                          {t("credentials.revoke.menu")}
                        </MenuItem>
                      </>
                    ) : null}
                  </>
                )}
                empty={
                  all.length ? (
                    <EmptyState
                      size="section"
                      icon={BadgeCheckIcon}
                      title={t("machine.empty.filteredTitle")}
                      description={t("machine.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("machine.empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={BadgeCheckIcon}
                      title={t("credentials.empty.title")}
                      description={t("credentials.empty.description")}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={() => setIssuing(true)}>
                            {t("credentials.issue.open")}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {rows.length > PAGE_SIZES[0] ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={rows.length}
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

      {canWrite ? <IssueDrawer open={issuing} onOpenChange={setIssuing} types={types} /> : null}
      <VerifyDrawer open={verifying} onOpenChange={setVerifying} />
    </>
  );
}

const VC_TONE: Record<VcStatus, BadgeTone> = {
  active: "success",
  expiring: "warning",
  expired: "danger",
  revoked: "neutral",
};

/** A credential's status, in its own words: "Valid", not "Active". */
function VcBadge({ status }: { status: VcStatus }) {
  const { t } = useTranslation("developer");
  return (
    <Badge tone={VC_TONE[status]} size="sm">
      {t(`credentials.status.${status}`)}
    </Badge>
  );
}
