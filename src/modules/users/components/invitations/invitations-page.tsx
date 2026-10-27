import {
  DownloadIcon,
  EllipsisIcon,
  MailIcon,
  SendIcon,
  TrashIcon,
  UserPlusIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatNumber,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Table,
  type TableSort,
  Text,
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
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useRoles } from "@/modules/authorization";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { type Invitation, inviteCalls, useInvitations } from "@/modules/users/api/invitations";
import { useUserDirectory } from "@/modules/users/api/users";
import {
  canResend,
  canRevoke,
  INVITE_STATUSES,
  type InvitationFilters,
  matchesInvite,
  SENT_WINDOWS,
} from "@/modules/users/invitations-model";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { type CsvColumn, exportToCsv } from "@/shared/utils/data-export";
import { AddPeopleDrawer } from "@/modules/users/components/add-people/add-people-drawer";
import { BandPlaceholder } from "@/modules/users/components/people/band-placeholder";
import { usePeopleRun } from "@/modules/users/components/people/people-bulk";
import "@/modules/users/components/people/people.css";
import { useKeyedState } from "@/modules/users/components/people/use-keyed-state";
import { InvitationsBand } from "./invitations-band";
import { InvitationRowActions, useInvitationColumns } from "./invitations-table";

const ANY = "";
const PAGE_SIZES = [25, 50, 100] as const;
const NONE: Invitation[] = [];

const csvColumns: CsvColumn<Invitation>[] = [
  { header: "email", value: (i) => i.email },
  { header: "role_id", value: (i) => i.role_id ?? "" },
  { header: "status", value: (i) => i.status },
  { header: "sent_at", value: (i) => i.created_at },
  { header: "expires_at", value: (i) => i.expires_at },
  { header: "accepted_at", value: (i) => i.accepted_at ?? "" },
];

export type InvitationsPageProps = {
  filters: InvitationFilters;
  onFiltersChange: (next: InvitationFilters) => void;
};

/**
 * Directory › Users › Invitations: everyone invited, whether they've joined, and the links still
 * waiting. Filters live in the address; the header's counts link into them.
 */
export function InvitationsPage({ filters, onFiltersChange }: InvitationsPageProps) {
  const { t } = useTranslation(["users", "common"]);
  const access = useCapabilities();
  const canInvite = access.can("user.write");
  const showRole = access.can("role.read");
  const tenantId = useTenantId();
  const [adding, setAdding] = useCreateIntent(canInvite);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const invitations = useInvitations();
  const roles = useRoles().data?.items ?? [];
  const directory = useUserDirectory();
  const { run, running } = usePeopleRun(() => setSelected([]));

  const invites = invitations.data?.items ?? NONE;
  const now = invitations.dataUpdatedAt || Date.now();
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name;
  const members = new Map((directory.data?.items ?? []).map((u) => [u.email.toLowerCase(), u]));
  const member = (email: string) => members.get(email.toLowerCase());

  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(50);
  const filterKey = JSON.stringify(filters);
  const [selected, setSelected] = useKeyedState<string[]>(filterKey, []);
  const [offset, setOffset] = useKeyedState(
    `${filterKey}|${sort?.column}|${sort?.direction}|${pageSize}`,
    0,
  );
  const rows = invites.filter((i) => matchesInvite(i, filters, now));
  if (sort) {
    const value = (i: Invitation) =>
      sort.column === "sent"
        ? Date.parse(i.created_at)
        : sort.column === "role"
          ? (roleName(i.role_id ?? "") ?? "")
          : i.email;
    const way = sort.direction === "ascending" ? 1 : -1;
    rows.sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) * way);
  }
  const onPage = rows.slice(offset, offset + pageSize);
  const columns = useInvitationColumns({ now, roleName, member, showRole });
  const byId = new Map(invites.map((i) => [i.id, i]));
  const n = (value: number) => formatNumber(value, formatLocale());

  const resend = (ids: string[]) => {
    const ok = ids.filter((id) => byId.get(id) && canResend(byId.get(id) as Invitation));
    run(t("invites.actions.resend"), ok, inviteCalls.resend);
  };
  const revoke = (ids: string[]) => {
    const ok = ids.filter((id) => byId.get(id) && canRevoke(byId.get(id) as Invitation));
    const only = ok.length === 1 ? byId.get(ok[0] ?? "") : undefined;
    run(t("invites.actions.revoke"), ok, inviteCalls.revoke, {
      title: only
        ? t("invites.confirm.revokeOne", { email: only.email })
        : t("invites.confirm.revokeMany", { n: ok.length }),
      description: t("invites.confirm.revokeDescription"),
      confirmLabel: t("invites.actions.revoke"),
      tone: "destructive",
    });
  };
  const inviteAgain = (i: Invitation) =>
    tenantId &&
    run(t("invites.actions.inviteAgain"), [i.id], () =>
      inviteCalls.create({ tenant_id: tenantId, email: i.email, role_id: i.role_id ?? undefined }),
    );

  const statusCount = (s: Invitation["status"]) => invites.filter((i) => i.status === s).length;
  const roleCounts = [
    ...invites.reduce(
      (m, i) => (i.role_id ? m.set(i.role_id, (m.get(i.role_id) ?? 0) + 1) : m),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1]);
  const set = (patch: Partial<InvitationFilters>) => onFiltersChange({ ...filters, ...patch });
  const pick = (key: keyof InvitationFilters) => (value: unknown) =>
    set({ [key]: value ? String(value) : undefined });
  const tags: AppliedFilter[] = [];
  if (filters.status)
    tags.push({
      id: "status",
      label: t("invites.columns.status"),
      value: t(`invites.status.${filters.status}`),
    });
  if (filters.role)
    tags.push({
      id: "role",
      label: t("people.columns.role"),
      value: roleName(filters.role) ?? filters.role,
    });
  if (filters.sent)
    tags.push({
      id: "sent",
      label: t("invites.columns.sent"),
      value: t(`invites.filters.sent.${filters.sent}`),
    });
  const pending = statusCount("pending");

  const toolbar = (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          ref={searchRef}
          className="ppl-search"
          aria-label={t("invites.filters.search")}
          placeholder={t("invites.filters.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => set({ q: q.trim() || undefined })}
        />
        <Select
          aria-label={t("invites.columns.status")}
          className="ppl-filter"
          value={filters.status ?? ANY}
          onValueChange={pick("status")}
          items={[
            { value: ANY, label: t("invites.filters.anyStatus") },
            ...INVITE_STATUSES.map((s) => ({
              value: s,
              label: `${t(`invites.status.${s}`)} · ${n(statusCount(s))}`,
            })),
          ]}
        />
        {showRole ? (
          <Select
            aria-label={t("people.columns.role")}
            className="ppl-filter"
            value={filters.role ?? ANY}
            onValueChange={pick("role")}
            items={[
              { value: ANY, label: t("people.filters.anyRole") },
              ...roleCounts.map(([id, count]) => ({
                value: id,
                label: `${roleName(id) ?? id} · ${n(count)}`,
              })),
            ]}
          />
        ) : null}
        <Select
          aria-label={t("invites.columns.sent")}
          className="ppl-filter"
          value={filters.sent ?? ANY}
          onValueChange={pick("sent")}
          items={[
            { value: ANY, label: t("people.filters.anyTime") },
            ...SENT_WINDOWS.map((w) => ({ value: w, label: t(`invites.filters.sent.${w}`) })),
          ]}
        />
      </div>
      {tags.length || filters.q ? (
        <FilterTags
          filters={tags}
          onRemove={(id) => set({ [id]: undefined })}
          onClear={() => onFiltersChange({ q: filters.q })}
          returnFocusTo={searchRef}
          summary={t("invites.filters.summary", { n: n(rows.length), total: n(invites.length) })}
        />
      ) : null}
    </div>
  );

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("invites.title")}
        count={invitations.data ? invites.length : undefined}
        description={t("invites.description")}
        actions={
          <>
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
                  onClick={() => exportToCsv("invitations", rows, csvColumns)}
                >
                  {t("people.exportCsv")}
                </MenuItem>
              </MenuContent>
            </Menu>
            {canInvite ? (
              <Button icon={UserPlusIcon} onClick={() => setAdding(true)}>
                {t("invites.invitePeople")}
              </Button>
            ) : null}
          </>
        }
        summary={
          invitations.data ? (
            <InvitationsBand invites={invites} now={now} />
          ) : invitations.isError ? undefined : (
            <BandPlaceholder />
          )
        }
        tabs={<PageTabList badges={{ "/invitations": pending }} />}
      />
      <PageContent>
        <div className="ppl">
          {!canInvite ? (
            <Alert tone="info" title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {invitations.isError ? (
            <DataState error={invitations.error} onRetry={() => invitations.refetch()} />
          ) : (
            <>
              <Table<Invitation>
                label={t("invites.title")}
                rows={onPage}
                rowId={(i) => i.id}
                rowLabel={(i) => i.email}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                selectable={canInvite}
                selected={canInvite ? selected : []}
                onSelectedChange={setSelected}
                loading={invitations.isLoading}
                toolbar={toolbar}
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
                      <Button variant="ghost" size="sm" icon={SendIcon} onClick={() => resend(ids)}>
                        {t("invites.bulk.resend", {
                          n: ids.filter(
                            (id) => byId.get(id) && canResend(byId.get(id) as Invitation),
                          ).length,
                        })}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={TrashIcon}
                        onClick={() => revoke(ids)}
                      >
                        {t("invites.actions.revoke")}
                      </Button>
                    </>
                  )
                }
                rowActions={
                  canInvite
                    ? (i) => (
                        <InvitationRowActions
                          invite={i}
                          member={member(i.email)}
                          onResend={(x) => resend([x.id])}
                          onRevoke={(x) => revoke([x.id])}
                          onInviteAgain={inviteAgain}
                        />
                      )
                    : undefined
                }
                empty={
                  <EmptyState
                    size="section"
                    icon={MailIcon}
                    title={
                      invites.length ? t("people.empty.filteredTitle") : t("invites.empty.title")
                    }
                    description={
                      invites.length
                        ? t("invites.empty.filteredDescription")
                        : t("invites.empty.description")
                    }
                    actions={
                      invites.length ? (
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("people.empty.clear")}
                        </Button>
                      ) : undefined
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
      {canInvite ? <AddPeopleDrawer open={adding} onOpenChange={setAdding} mode="invite" /> : null}
    </PageTabs>
  );
}
