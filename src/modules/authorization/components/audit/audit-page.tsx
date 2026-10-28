import { ScrollTextIcon } from "@qeetrix/icons";
import { Button, Select, Table, type TableColumn, Text } from "@qeetrix/react";
import {
  AvatarItem,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAbacPolicies } from "@/modules/authorization/api/abac";
import {
  type ActivityEvent,
  CHANGE_KINDS,
  type ChangeFilters,
  type ChangeKind,
  useAuthzChanges,
  useAuthzSummary,
} from "@/modules/authorization/api/authz-activity";
import { useRoles } from "@/modules/authorization/api/rbac";
import { PageBreadcrumb } from "@/modules/dashboard";
import { groupQueries } from "@/modules/groups";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { BandPlaceholder, When } from "../lists/authz-parts";
import { AuditBand, ChangeDrawer } from "./audit-parts";
import { actorName, type ChangeContext, changeTarget, titleText } from "./change-model";
import "../lists/authz-lists.css";

const PAGE_SIZE = 25;
const ANY = "";

/** Names for what the log keeps as IDs: roles, people, groups and policies the caller may read. */
function useChangeContext(): ChangeContext {
  const tenantId = useTenantId();
  const can = useCapabilities().can;
  const roles = useRoles().data?.items;
  const people = useQuery({
    ...userQueries.directory(tenantId),
    enabled: can("user.read") && !!tenantId,
  }).data?.items;
  const groups = useQuery({
    ...groupQueries.list(tenantId),
    enabled: can("group.read") && !!tenantId,
  }).data?.items;
  const policies = useAbacPolicies(can("policy.read")).data?.items;
  return useMemo(() => {
    const index = <T,>(items: T[] | undefined, id: (x: T) => string, name: (x: T) => string) => {
      const map = new Map((items ?? []).map((x) => [id(x), name(x)]));
      return (key: string) => map.get(key);
    };
    return {
      roleName: index(
        roles,
        (r) => r.id,
        (r) => r.name,
      ),
      personName: index(
        people,
        (u) => u.id,
        (u) => u.display_name?.trim() || u.email,
      ),
      groupName: index(
        groups,
        (g) => g.id,
        (g) => g.name,
      ),
      policyName: index(
        policies,
        (p) => p.id,
        (p) => p.name,
      ),
    };
  }, [roles, people, groups, policies]);
}

export type AuditFilters = ChangeFilters;

/**
 * Authorization › Audit: who changed which role, policy or relationship, when and from where, from
 * the audit log (newest first, a page of the server's at a time). The band covers the last 90 days.
 * A row opens the change.
 */
export function AuthorizationAuditPage({
  filters,
  onFiltersChange,
  open,
  onOpenChange,
}: {
  filters: AuditFilters;
  onFiltersChange: (next: AuditFilters) => void;
  /** The change whose drawer is open (`?event=<id>`). */
  open?: string;
  onOpenChange: (id: string | undefined) => void;
}) {
  const { t } = useTranslation("authorization");
  const ctx = useChangeContext();
  const changes = useAuthzChanges(filters);
  const summary = useAuthzSummary();
  const { events } = changes;
  const [offset, setOffset] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<AuditFilters>) => {
    setOffset(0);
    onFiltersChange({ ...filters, ...patch });
  };
  const now = changes.dataUpdatedAt || Date.now();

  // A page past what's loaded asks the server for the next one.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = changes;
  useEffect(() => {
    if (offset + PAGE_SIZE > events.length && hasNextPage && !isFetchingNextPage)
      void fetchNextPage();
  }, [offset, events.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
  const onPage = events.slice(offset, offset + PAGE_SIZE);

  // Who changed things, from the changes loaded, to filter by.
  const actors = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      const id = e.actor?.id;
      if (id && !map.has(id)) map.set(id, actorName(e, ctx) ?? id.slice(0, 8));
    }
    if (filters.actor && !map.has(filters.actor))
      map.set(filters.actor, ctx.personName(filters.actor) ?? filters.actor.slice(0, 8));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events, ctx, filters.actor]);

  const columns: TableColumn<ActivityEvent>[] = [
    {
      id: "at",
      header: t("lists.audit.columns.when"),
      width: 130,
      cell: (e) => <When at={e.at} now={now} />,
    },
    {
      id: "change",
      header: t("lists.audit.columns.change"),
      primary: true,
      width: 200,
      cell: (e) => (
        <span className="authz-nowrap">
          <ChangeTitle event={e} />
        </span>
      ),
    },
    {
      id: "on",
      header: t("lists.audit.columns.on"),
      cell: (e) => <ChangeOn event={e} ctx={ctx} />,
    },
    {
      id: "by",
      header: t("lists.audit.columns.by"),
      width: 210,
      cell: (e) => {
        const name = actorName(e, ctx);
        return name ? (
          <AvatarItem name={name} size="sm" />
        ) : (
          <Text tone="subtle">{t("lists.common.system")}</Text>
        );
      },
    },
    {
      id: "from",
      header: t("lists.audit.columns.from"),
      width: 140,
      cell: (e) => <span className="authz-mono">{e.ip || "—"}</span>,
    },
  ];

  const tags = [
    ...(filters.kind
      ? [
          {
            id: "kind",
            label: t("lists.audit.filters.kind"),
            value: t(`lists.audit.kinds.${filters.kind}`),
          },
        ]
      : []),
    ...(filters.actor
      ? [
          {
            id: "actor",
            label: t("lists.audit.filters.by"),
            value: actors.find(([id]) => id === filters.actor)?.[1] ?? filters.actor,
          },
        ]
      : []),
  ];
  const openEvent = open ? events.find((e) => e.id === open) : undefined;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.audit.title")}
        description={t("lists.audit.description")}
        summary={
          summary.error ? undefined : summary.pending || !summary.all ? (
            <BandPlaceholder cells={3} />
          ) : (
            <AuditBand summary={summary} />
          )
        }
      />
      <PageContent>
        <div className="authz-page">
          {changes.isError ? (
            <DataState error={changes.error} onRetry={() => changes.refetch()} />
          ) : (
            <>
              <Table<ActivityEvent>
                label={t("lists.audit.tableLabel")}
                rows={onPage}
                rowId={(e) => e.id}
                rowLabel={(e) => `${titleText(e)} ${changeTarget(e, ctx).label}`}
                columns={columns}
                loading={changes.isLoading || (isFetchingNextPage && onPage.length === 0)}
                renderRowLink={(e) => (
                  <RouterLink to="/authorization/audit" search={{ ...filters, event: e.id }} />
                )}
                toolbar={
                  <div className="ppl-toolbar">
                    <div className="ppl-filters">
                      <SearchField
                        ref={searchRef}
                        className="ppl-search"
                        aria-label={t("lists.audit.filters.search")}
                        placeholder={t("lists.audit.filters.searchPlaceholder")}
                        value={text}
                        onValueChange={setText}
                        onSearch={(q) => set({ q: q.trim() || undefined })}
                      />
                      <Select
                        aria-label={t("lists.audit.filters.kind")}
                        className="ppl-filter"
                        value={filters.kind ?? ANY}
                        onValueChange={(v) =>
                          set({ kind: v ? (String(v) as ChangeKind) : undefined })
                        }
                        items={[
                          { value: ANY, label: t("lists.audit.filters.anyKind") },
                          ...CHANGE_KINDS.map((k) => ({
                            value: k,
                            label: t(`lists.audit.kinds.${k}`),
                          })),
                        ]}
                      />
                      <Select
                        aria-label={t("lists.audit.filters.by")}
                        className="ppl-filter"
                        value={filters.actor ?? ANY}
                        onValueChange={(v) => set({ actor: v ? String(v) : undefined })}
                        items={[
                          { value: ANY, label: t("lists.audit.filters.anyone") },
                          ...actors.map(([id, name]) => ({ value: id, label: name })),
                        ]}
                      />
                    </div>
                    {tags.length ? (
                      <FilterTags
                        filters={tags}
                        onRemove={(id) => set({ [id]: undefined })}
                        onClear={() => onFiltersChange({ q: filters.q })}
                        returnFocusTo={searchRef}
                      />
                    ) : null}
                  </div>
                }
                empty={
                  filters.q || filters.kind || filters.actor ? (
                    <EmptyState
                      size="section"
                      icon={ScrollTextIcon}
                      title={t("lists.common.noMatchTitle")}
                      description={t("lists.common.noMatchDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => onFiltersChange({})}>
                          {t("lists.common.clearFilters")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={ScrollTextIcon}
                      title={t("lists.audit.empty.title")}
                      description={t("lists.audit.empty.description")}
                    />
                  )
                }
              />
              {events.length > 0 ? (
                <Pagination
                  offset={offset}
                  pageSize={PAGE_SIZE}
                  itemsOnPage={onPage.length}
                  total={hasNextPage ? undefined : events.length}
                  loading={isFetchingNextPage}
                  onOffsetChange={setOffset}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>
      <ChangeDrawer
        eventId={open}
        loaded={openEvent}
        ctx={ctx}
        onClose={() => onOpenChange(undefined)}
      />
    </>
  );
}

/** A change's title, in the reader's language (re-renders when it changes). */
function ChangeTitle({ event }: { event: ActivityEvent }) {
  useTranslation("authorization");
  return <>{titleText(event)}</>;
}

/** What a change is on: a role to whom, a policy, a role, or a relationship's three parts. */
function ChangeOn({ event, ctx }: { event: ActivityEvent; ctx: ChangeContext }) {
  const { t } = useTranslation("authorization");
  const target = changeTarget(event, ctx);
  const label = <span className={target.mono ? "authz-mono" : undefined}>{target.label}</span>;
  if (!target.role)
    return (
      <span className="authz-clip" title={target.label}>
        {label}
      </span>
    );
  const taken = event.type.endsWith("unassigned");
  return (
    <span className="authz-clip">
      {t(taken ? "lists.audit.cells.roleFrom" : "lists.audit.cells.roleTo", {
        role: target.role,
        to: target.label,
      })}
    </span>
  );
}
