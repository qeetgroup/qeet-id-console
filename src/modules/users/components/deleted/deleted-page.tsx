import {
  DownloadIcon,
  EllipsisIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Meter,
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
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useRetentionPolicy } from "@/modules/compliance";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useInvitations } from "@/modules/users/api/invitations";
import {
  type DeletedUser,
  perUserCalls,
  useDeletedUsers,
  useUserDirectory,
} from "@/modules/users/api/users";
import { BandPlaceholder } from "@/modules/users/components/people/band-placeholder";
import { usePeopleRun } from "@/modules/users/components/people/people-bulk";
import "@/modules/users/components/people/people.css";
import { useKeyedState } from "@/modules/users/components/people/use-keyed-state";
import {
  type DeletedFilters,
  daysUntil,
  matchesDeleted,
  PURGE_WINDOWS,
  purgeAt,
} from "@/modules/users/deleted-model";
import { personName } from "@/modules/users/people-model";
import { useUserId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type CsvColumn, exportToCsv } from "@/shared/utils/data-export";

const ANY = "";
const PAGE_SIZES = [25, 50, 100] as const;
const NONE: DeletedUser[] = [];
const csvColumns: CsvColumn<DeletedUser>[] = [
  { header: "id", value: (u) => u.id },
  { header: "email", value: (u) => u.email },
  { header: "display_name", value: (u) => u.display_name },
  { header: "deleted_at", value: (u) => u.deleted_at },
  { header: "deleted_by", value: (u) => u.deleted_by ?? "" },
];

export type DeletedUsersPageProps = {
  filters: DeletedFilters;
  onFiltersChange: (next: DeletedFilters) => void;
};

/**
 * Directory › Users › Deleted: the recycle bin, with its rule in view — how many are waiting, who's
 * purged next and when, and how long people are kept. Restore brings someone back; Delete forever
 * purges them now.
 */
export function DeletedUsersPage({ filters, onFiltersChange }: DeletedUsersPageProps) {
  const { t } = useTranslation(["users", "common"]);
  const access = useCapabilities();
  const canWrite = access.can("user.write");
  const canReadRetention = access.can("policy.read");
  const currentUserId = useUserId();
  const deleted = useDeletedUsers();
  const retention = useRetentionPolicy(canReadRetention);
  const directory = useUserDirectory();
  const pending = useInvitations(canWrite).data?.items.filter((i) => i.status === "pending").length;
  const { run, running } = usePeopleRun(() => setSelected([]));
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const users = deleted.data?.items ?? NONE;
  const now = deleted.dataUpdatedAt || Date.now();
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  // Days kept, or null when nothing purges them automatically (off, or not ours to read).
  const keepDays = retention.data?.deleted_users_enabled ? retention.data.deleted_users_days : null;
  const names = new Map((directory.data?.items ?? []).map((u) => [u.id, personName(u)]));
  const who = (id?: string | null) =>
    !id
      ? t("deletedPage.someone")
      : id === currentUserId
        ? t("deletedPage.you")
        : (names.get(id) ?? t("deletedPage.someone"));

  const [pageSize, setPageSize] = useState<number>(50);
  const filterKey = JSON.stringify(filters);
  const [selected, setSelected] = useKeyedState<string[]>(filterKey, []);
  const [offset, setOffset] = useKeyedState(`${filterKey}|${pageSize}`, 0);
  const rows = users.filter((u) => matchesDeleted(u, filters, keepDays, now));
  const onPage = rows.slice(offset, offset + pageSize);
  const next = [...users]
    .map((u) => ({ u, at: purgeAt(u, keepDays) }))
    .filter((x): x is { u: DeletedUser; at: number } => x.at !== null)
    .sort((a, b) => a.at - b.at)[0];
  const deleters = [
    ...users.reduce(
      (m, u) => (u.deleted_by ? m.set(u.deleted_by, (m.get(u.deleted_by) ?? 0) + 1) : m),
      new Map<string, number>(),
    ),
  ];

  const restore = (ids: string[]) => run(t("deletedPage.restore"), ids, perUserCalls.restore);
  const purge = (ids: string[]) => {
    const only = ids.length === 1 ? users.find((u) => u.id === ids[0]) : undefined;
    run(t("deletedPage.purge"), ids, perUserCalls.purge, {
      title: only
        ? t("deleted.purgeTitle", { email: only.email })
        : t("deletedPage.purgeMany", { n: ids.length }),
      description: t("deleted.purgeDescription"),
      confirmLabel: t("deleted.purgeLabel"),
      tone: "destructive",
    });
  };

  const when = (at: string) => (
    <time dateTime={at} title={formatDateTime(at, locale)} className="ppl-nowrap">
      {formatRelativeTime(Math.min(Date.parse(at), now), locale, now)}
    </time>
  );
  const columns: TableColumn<DeletedUser>[] = [
    {
      id: "person",
      header: t("people.columns.person"),
      primary: true,
      cell: (u) => <AvatarItem name={personName(u)} description={u.email} />,
    },
    { id: "deleted", header: t("deletedPage.columns.deleted"), cell: (u) => when(u.deleted_at) },
    { id: "by", header: t("deletedPage.columns.by"), cell: (u) => who(u.deleted_by) },
    ...(keepDays === null
      ? []
      : [
          {
            id: "purge",
            header: t("deletedPage.columns.purged"),
            cell: (u: DeletedUser) => {
              const at = purgeAt(u, keepDays) ?? now;
              const left = daysUntil(at, now);
              return (
                <span
                  className={left <= 7 ? "sub-warn ppl-nowrap" : "ppl-nowrap"}
                  title={formatDate(at, locale, { dateStyle: "long" })}
                >
                  {left === 0
                    ? t("deletedPage.purgeDue")
                    : t("deletedPage.inDays", { count: left })}
                </span>
              );
            },
          } satisfies TableColumn<DeletedUser>,
        ]),
    {
      id: "joined",
      header: t("people.columns.joined"),
      numeric: true,
      cell: (u) => (
        <time
          className="ppl-nowrap"
          dateTime={u.created_at}
          title={formatDate(u.created_at, locale, { dateStyle: "long" })}
        >
          {new Date(u.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" })}
        </time>
      ),
    },
  ];

  const set = (patch: Partial<DeletedFilters>) => onFiltersChange({ ...filters, ...patch });
  const tags: AppliedFilter[] = [];
  if (filters.purge)
    tags.push({
      id: "purge",
      label: t("deletedPage.columns.purged"),
      value: t(`deletedPage.filters.purge.${filters.purge}`),
    });
  if (filters.by)
    tags.push({ id: "by", label: t("deletedPage.columns.by"), value: who(filters.by) });

  const band = (
    <dl className="ppl-band is-three">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("deletedPage.band.bin")}</dt>
        <dd className="ppl-value">{n(users.length)}</dd>
        <dd className="ppl-note">{t("deletedPage.band.binNote")}</dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("deletedPage.band.next")}</dt>
        {next && keepDays !== null ? (
          <>
            <dd className="ppl-value">
              {daysUntil(next.at, now) === 0
                ? t("deletedPage.purgeDue")
                : t("deletedPage.inDays", { count: daysUntil(next.at, now) })}
            </dd>
            <dd className="ppl-note">
              {personName(next.u)} · {formatDate(next.at, locale)}
            </dd>
            <dd className="ppl-meter">
              <Meter
                value={Math.min(100, ((keepDays - daysUntil(next.at, now)) / keepDays) * 100)}
                tone="neutral"
                aria-label={t("deletedPage.band.usedLabel", {
                  used: keepDays - daysUntil(next.at, now),
                  days: keepDays,
                })}
              />
            </dd>
            <dd className="ppl-chart-caption">
              {t("deletedPage.band.used", {
                used: keepDays - daysUntil(next.at, now),
                days: keepDays,
              })}
            </dd>
          </>
        ) : (
          <>
            <dd className="ppl-value">—</dd>
            <dd className="ppl-note">
              {keepDays === null
                ? t("deletedPage.band.noAutoPurge")
                : t("deletedPage.band.noneDue")}
            </dd>
          </>
        )}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("deletedPage.band.kept")}</dt>
        {canReadRetention && retention.data ? (
          <>
            <dd className="ppl-value">
              {retention.data.deleted_users_enabled
                ? t("deletedPage.band.days", { n: retention.data.deleted_users_days })
                : t("deletedPage.band.untilDeleted")}
            </dd>
            <dd className="ppl-note">
              {retention.data.deleted_users_enabled
                ? t("deletedPage.band.thenPurged")
                : t("deletedPage.band.autoPurgeOff")}
            </dd>
            <dd className="ppl-link">
              <Link to="/security/compliance/retention">{t("deletedPage.band.change")}</Link>
            </dd>
          </>
        ) : (
          <>
            <dd className="ppl-value">—</dd>
            <dd className="ppl-note">{t("deletedPage.band.noRetentionAccess")}</dd>
          </>
        )}
      </div>
    </dl>
  );

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("deletedPage.title")}
        count={deleted.data ? users.length : undefined}
        description={
          keepDays === null
            ? t("deletedPage.descriptionNoPurge")
            : t("deletedPage.description", { n: keepDays })
        }
        actions={
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
              <MenuItem
                icon={DownloadIcon}
                disabled={rows.length === 0}
                onClick={() => exportToCsv("deleted-users", rows, csvColumns)}
              >
                {t("people.exportCsv")}
              </MenuItem>
              {canReadRetention ? (
                <MenuItem
                  icon={SlidersHorizontalIcon}
                  render={<Link to="/security/compliance/retention" />}
                >
                  {t("deletedPage.retentionSettings")}
                </MenuItem>
              ) : null}
            </MenuContent>
          </Menu>
        }
        summary={deleted.data ? band : deleted.isError ? undefined : <BandPlaceholder cells={3} />}
        tabs={<PageTabList badges={{ "/invitations": pending }} />}
      />
      <PageContent>
        <div className="ppl">
          {deleted.isError ? (
            <DataState error={deleted.error} onRetry={() => deleted.refetch()} />
          ) : (
            <>
              <Table<DeletedUser>
                label={t("deletedPage.title")}
                rows={onPage}
                rowId={(u) => u.id}
                rowLabel={personName}
                columns={columns}
                selectable={canWrite}
                selected={canWrite ? selected : []}
                onSelectedChange={setSelected}
                loading={deleted.isLoading}
                toolbar={
                  <div className="ppl-toolbar">
                    <div className="ppl-filters">
                      <SearchField
                        ref={searchRef}
                        className="ppl-search"
                        aria-label={t("deletedPage.filters.search")}
                        placeholder={t("people.filters.searchPlaceholder")}
                        value={text}
                        onValueChange={setText}
                        onSearch={(q) => set({ q: q.trim() || undefined })}
                      />
                      {keepDays !== null ? (
                        <Select
                          aria-label={t("deletedPage.columns.purged")}
                          className="ppl-filter"
                          value={filters.purge ?? ANY}
                          onValueChange={(v) =>
                            set({ purge: v ? (String(v) as DeletedFilters["purge"]) : undefined })
                          }
                          items={[
                            { value: ANY, label: t("people.filters.anyTime") },
                            ...PURGE_WINDOWS.map((w) => ({
                              value: w,
                              label: t(`deletedPage.filters.purge.${w}`),
                            })),
                          ]}
                        />
                      ) : null}
                      <Select
                        aria-label={t("deletedPage.columns.by")}
                        className="ppl-filter"
                        value={filters.by ?? ANY}
                        onValueChange={(v) => set({ by: v ? String(v) : undefined })}
                        items={[
                          { value: ANY, label: t("deletedPage.filters.anyone") },
                          ...deleters.map(([id, count]) => ({
                            value: id,
                            label: `${who(id)} · ${n(count)}`,
                          })),
                        ]}
                      />
                    </div>
                    {tags.length || filters.q ? (
                      <FilterTags
                        filters={tags}
                        onRemove={(id) => set({ [id]: undefined })}
                        onClear={() => onFiltersChange({ q: filters.q })}
                        returnFocusTo={searchRef}
                        summary={t("deletedPage.filters.summary", {
                          n: n(rows.length),
                          total: n(users.length),
                        })}
                      />
                    ) : null}
                  </div>
                }
                bulkActions={(ids) =>
                  running ? (
                    <Text tone="subtle" role="status">
                      {t("people.bulk.progress", {
                        label: running.label,
                        done: running.done,
                        total: running.total,
                      })}
                    </Text>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={RotateCcwIcon}
                        onClick={() => restore(ids)}
                      >
                        {t("deletedPage.restoreN", { n: ids.length })}
                      </Button>
                      <Button variant="ghost" size="sm" icon={TrashIcon} onClick={() => purge(ids)}>
                        {t("deletedPage.purge")}
                      </Button>
                    </>
                  )
                }
                rowActions={
                  canWrite
                    ? (u) => (
                        <>
                          <MenuItem icon={RotateCcwIcon} onClick={() => restore([u.id])}>
                            {t("deletedPage.restore")}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={TrashIcon} tone="danger" onClick={() => purge([u.id])}>
                            {t("deletedPage.purgeEllipsis")}
                          </MenuItem>
                        </>
                      )
                    : undefined
                }
                empty={
                  <EmptyState
                    size="section"
                    icon={TrashIcon}
                    title={
                      users.length ? t("people.empty.filteredTitle") : t("deletedPage.empty.title")
                    }
                    description={
                      users.length
                        ? t("people.empty.filteredDescription")
                        : t("deletedPage.empty.description")
                    }
                  />
                }
              />
              {rows.length > 0 ? (
                <Pagination
                  offset={offset}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={rows.length}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={setPageSize}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>
    </PageTabs>
  );
}
