import { FileClockIcon, ScrollTextIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  MenuItem,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import {
  AvatarItem,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useAbacPolicies } from "@/modules/authorization/api/abac";
import { useAuthzChanges } from "@/modules/authorization/api/authz-activity";
import { BandPlaceholder, When, useCount } from "../lists/authz-parts";
import {
  CHANGES,
  DAY_MS,
  type PolicyVersion,
  policyVersions,
  type VersionChange,
  type VersionFilters,
} from "./versions-model";
import { VersionDrawerContent, VersionsBand } from "./versions-parts";
import "../lists/authz-lists.css";

const ANY = "";
// Walks the log to its start, up to this many pages of 50: numbering needs every save.
const MAX_PAGES = 20;

/**
 * Policies › Versions: every saved change to a policy, newest first, numbered per policy. A row
 * opens the change: what the log kept of it beside the version before.
 */
export function PolicyVersionsPage({
  filters,
  onFiltersChange,
  open,
  onOpenChange,
}: {
  filters: VersionFilters;
  onFiltersChange: (next: VersionFilters) => void;
  /** The version (its audit event) whose drawer is open (`?version=<id>`). */
  open?: string;
  onOpenChange: (id: string | undefined) => void;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const tenantId = useTenantId();
  const can = useCapabilities().can;
  const navigate = useNavigate();
  const canAudit = can("audit.read");
  const changes = useAuthzChanges({ kind: "policies" }, canAudit);
  const policiesQ = useAbacPolicies();
  const people = useQuery({
    ...userQueries.directory(tenantId),
    enabled: can("user.read") && !!tenantId,
  }).data?.items;
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<VersionFilters>) => onFiltersChange({ ...filters, ...patch });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, events } = changes;
  const pages = changes.data?.pages.length ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pages < MAX_PAGES) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, pages, fetchNextPage]);

  const policies = policiesQ.data?.items;
  const all = useMemo(() => {
    const names = new Map((policies ?? []).map((p) => [p.id, p.name]));
    return policyVersions(events, (id) => names.get(id));
  }, [events, policies]);
  const byName = useMemo(() => {
    const names = new Map((people ?? []).map((u) => [u.id, u.display_name?.trim() || u.email]));
    return (v: PolicyVersion) =>
      v.event.actor?.name?.trim() || (v.event.actor?.id ? names.get(v.event.actor.id) : undefined);
  }, [people]);
  const now = changes.dataUpdatedAt || Date.now();

  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    return all.filter(
      (v) =>
        (!filters.policy || v.policyId === filters.policy) &&
        (!filters.actor || v.event.actor?.id === filters.actor) &&
        (!filters.change || v.change === filters.change) &&
        (filters.look !== "week" || now - Date.parse(v.event.at) <= 7 * DAY_MS) &&
        (!q || v.policy.toLowerCase().includes(q)),
    );
  }, [all, filters, now]);

  const policyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of all) if (!map.has(v.policyId)) map.set(v.policyId, v.policy);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of all) {
      const id = v.event.actor?.id;
      if (id && !map.has(id)) map.set(id, byName(v) ?? id.slice(0, 8));
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, byName]);

  const columns: TableColumn<PolicyVersion>[] = [
    {
      id: "policy",
      header: t("lists.versions.columns.policy"),
      primary: true,
      cell: (v) => v.policy,
    },
    {
      id: "version",
      header: t("lists.versions.columns.version"),
      width: 150,
      cell: (v) => (
        <span className="authz-inline">
          <span className="authz-num">{t("lists.versions.cells.version", { n: v.n })}</span>
          {v.current ? <Badge size="sm">{t("lists.versions.cells.current")}</Badge> : null}
        </span>
      ),
    },
    {
      id: "change",
      header: t("lists.versions.columns.change"),
      width: 120,
      cell: (v) => t(`lists.versions.cells.${v.change}`),
    },
    {
      id: "by",
      header: t("lists.versions.columns.by"),
      width: 200,
      cell: (v) => {
        const name = byName(v);
        return name ? (
          <AvatarItem name={name} size="sm" />
        ) : (
          <Text tone="subtle">{t("lists.common.system")}</Text>
        );
      },
    },
    {
      id: "at",
      header: t("lists.versions.columns.when"),
      numeric: true,
      width: 140,
      cell: (v) => <When at={v.event.at} now={now} />,
    },
  ];

  const tags = [
    ...(filters.policy
      ? [
          {
            id: "policy",
            label: t("lists.versions.filters.policy"),
            value: policyOptions.find(([id]) => id === filters.policy)?.[1] ?? filters.policy,
          },
        ]
      : []),
    ...(filters.actor
      ? [
          {
            id: "actor",
            label: t("lists.versions.filters.by"),
            value: actorOptions.find(([id]) => id === filters.actor)?.[1] ?? filters.actor,
          },
        ]
      : []),
    ...(filters.change
      ? [
          {
            id: "change",
            label: t("lists.versions.filters.change"),
            value: t(`lists.versions.cells.${filters.change}`),
          },
        ]
      : []),
    ...(filters.look
      ? [
          {
            id: "look",
            label: t("lists.common.needsALook"),
            value: t("lists.versions.band.looks.week"),
          },
        ]
      : []),
  ];
  const openVersion = open ? all.find((v) => v.event.id === open) : undefined;
  const loading = changes.isLoading || policiesQ.isLoading;

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.versions.title")}
        description={t("lists.versions.description")}
        tabs={<PageTabList />}
        summary={
          !canAudit || changes.isError ? undefined : loading || hasNextPage ? (
            <BandPlaceholder cells={3} />
          ) : (
            <VersionsBand all={all} policies={policies?.length ?? 0} now={now} />
          )
        }
      />
      <PageContent>
        <div className="authz-page">
          {!canAudit ? (
            <EmptyState
              size="section"
              icon={FileClockIcon}
              title={t("lists.versions.empty.title")}
              description={t("lists.versions.cantRead")}
            />
          ) : changes.isError ? (
            <DataState error={changes.error} onRetry={() => changes.refetch()} />
          ) : (
            <Table<PolicyVersion>
              label={t("lists.versions.tableLabel")}
              rows={rows}
              rowId={(v) => v.event.id}
              rowLabel={(v) => t("lists.versions.rowLabel", { policy: v.policy, n: v.n })}
              columns={columns}
              loading={loading}
              renderRowLink={(v) => (
                <Link to="/authorization/versions" search={{ ...filters, version: v.event.id }} />
              )}
              rowActions={(v) => (
                <>
                  <MenuItem icon={FileClockIcon} onClick={() => onOpenChange(v.event.id)}>
                    {t("lists.versions.rowActions.open")}
                  </MenuItem>
                  <MenuItem
                    icon={ScrollTextIcon}
                    onClick={() =>
                      void navigate({ to: "/authorization/audit", search: { event: v.event.id } })
                    }
                  >
                    {t("lists.versions.rowActions.audit")}
                  </MenuItem>
                </>
              )}
              toolbar={
                <div className="ppl-toolbar">
                  <div className="ppl-filters">
                    <SearchField
                      ref={searchRef}
                      className="ppl-search"
                      aria-label={t("lists.versions.filters.search")}
                      placeholder={t("lists.versions.filters.searchPlaceholder")}
                      value={text}
                      onValueChange={setText}
                      onSearch={(q) => set({ q: q.trim() || undefined })}
                    />
                    <Select
                      aria-label={t("lists.versions.filters.policy")}
                      className="ppl-filter"
                      value={filters.policy ?? ANY}
                      onValueChange={(v) => set({ policy: v ? String(v) : undefined })}
                      items={[
                        { value: ANY, label: t("lists.versions.filters.anyPolicy") },
                        ...policyOptions.map(([id, name]) => ({ value: id, label: name })),
                      ]}
                    />
                    <Select
                      aria-label={t("lists.versions.filters.by")}
                      className="ppl-filter"
                      value={filters.actor ?? ANY}
                      onValueChange={(v) => set({ actor: v ? String(v) : undefined })}
                      items={[
                        { value: ANY, label: t("lists.versions.filters.anyone") },
                        ...actorOptions.map(([id, name]) => ({ value: id, label: name })),
                      ]}
                    />
                    <Select
                      aria-label={t("lists.versions.filters.change")}
                      className="ppl-filter"
                      value={filters.change ?? ANY}
                      onValueChange={(v) =>
                        set({ change: v ? (String(v) as VersionChange) : undefined })
                      }
                      items={[
                        { value: ANY, label: t("lists.versions.filters.anyChange") },
                        ...CHANGES.map((c) => ({
                          value: c,
                          label: `${t(`lists.versions.cells.${c}`)} · ${n(all.filter((v) => v.change === c).length)}`,
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
                      summary={t("lists.versions.filters.summary", {
                        n: n(rows.length),
                        total: n(all.length),
                      })}
                    />
                  ) : null}
                </div>
              }
              empty={
                all.length ? (
                  <EmptyState
                    size="section"
                    icon={FileClockIcon}
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
                    icon={FileClockIcon}
                    title={t("lists.versions.empty.title")}
                    description={t("lists.versions.empty.description")}
                  />
                )
              }
            />
          )}
        </div>
      </PageContent>
      <Drawer open={!!openVersion} onOpenChange={(o) => !o && onOpenChange(undefined)}>
        {openVersion ? (
          <VersionDrawerContent version={openVersion} by={byName(openVersion)} />
        ) : null}
      </Drawer>
    </PageTabs>
  );
}
