import {
  EyeIcon,
  KeyRoundIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  SendIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import { Button, MenuItem, MenuSeparator, Select, Table } from "@qeetrix/react";
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
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import { useWebhooks, type Webhook } from "@/modules/developer/api/webhooks";
import {
  type EventArea,
  eventAreas,
  overlapUntil,
  WEBHOOK_STATES,
  type WebhookState,
  webhookState,
} from "@/modules/developer/webhook-state";
import { BandCount, BandLooks, BandPlaceholder, BandSplit, useNumbers, When } from "../parts";
import { useWebhookActions } from "./use-webhook-actions";
import { WebhookDrawer } from "./webhook-drawer";
import { Endpoint, useStateLine, WebhookBadge } from "./webhook-parts";
import "../developer.css";

const PAGE_SIZES = [25, 50, 100] as const;
const ANY = "";
export type WebhookFilters = {
  q?: string;
  status?: WebhookState;
  area?: EventArea;
  look?: "overlap";
};
const STATE_COLOR: Record<WebhookState, string> = {
  active: "var(--qx-color-dataviz-positive)",
  failing: "var(--qx-color-dataviz-warning)",
  autoDisabled: "var(--qx-color-dataviz-negative)",
  disabled: "var(--ppl-never)",
};

/**
 * Developer › Webhooks: the endpoints Qeet ID posts events to. Each row is an endpoint (its host,
 * the areas it listens to, its state with why), opening its page. The band says how many are on,
 * which are failing or turned off, and what they listen to.
 */
export function WebhooksPage({
  filters,
  onFiltersChange,
}: {
  filters: WebhookFilters;
  onFiltersChange: (next: WebhookFilters) => void;
}) {
  const { t } = useTranslation(["developer", "common"]);
  const { n } = useNumbers();
  const access = useCapabilities();
  const canWrite = access.can("webhook.write");
  const hooksQ = useWebhooks();
  const actions = useWebhookActions();
  const stateLine = useStateLine();
  const [creating, setCreating] = useCreateIntent(canWrite);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const all = useMemo(() => hooksQ.data?.items ?? [], [hooksQ.data]);
  const now = hooksQ.dataUpdatedAt || Date.now();
  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    return all.filter(
      (w) =>
        (!filters.status || webhookState(w) === filters.status) &&
        (!filters.area || eventAreas(w.events).some((a) => a.area === filters.area)) &&
        (!filters.look || !!overlapUntil(w, now)) &&
        (!q || `${w.url} ${w.events.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [all, filters, now]);
  const start = offset < rows.length ? offset : 0;
  const onPage = rows.slice(start, start + pageSize);
  const change = (next: WebhookFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };
  const set = (patch: Partial<WebhookFilters>) => change({ ...filters, ...patch });
  const to = (search: WebhookFilters) => ({ to: "/developer/webhooks", search });
  const states = WEBHOOK_STATES.map((id) => ({
    id,
    count: all.filter((w) => webhookState(w) === id).length,
  }));
  const on = all.filter((w) => !w.disabled_at).length;
  const areas = new Map<EventArea, number>();
  for (const w of all)
    for (const { area } of eventAreas(w.events)) areas.set(area, (areas.get(area) ?? 0) + 1);
  const topAreas = [...areas]
    .filter(([a]) => a !== "test")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const tags: AppliedFilter[] = [];
  if (filters.status)
    tags.push({
      id: "status",
      label: t("machine.filters.status"),
      value: t(`webhooks.state.${filters.status}`),
    });
  if (filters.area)
    tags.push({
      id: "area",
      label: t("webhooks.listensTo"),
      value: t(`webhooks.area.${filters.area}`),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("machine.band.needsALook"),
      value: t("webhooks.looks.overlap"),
    });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("webhooks.title")}
        count={hooksQ.data ? all.length : undefined}
        description={t("webhooks.description")}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => setCreating(true)}>
              {t("webhooks.new")}
            </Button>
          ) : undefined
        }
        summary={
          hooksQ.isError ? undefined : !hooksQ.data ? (
            <BandPlaceholder cells={4} />
          ) : (
            <dl className="ppl-band">
              <BandCount
                label={t("webhooks.band.on")}
                value={n(on)}
                note={t("webhooks.band.onNote", { off: n(all.length - on), total: n(all.length) })}
              />
              <BandSplit
                label={t("webhooks.band.status")}
                parts={states.map((p) => ({
                  ...p,
                  label: t(`webhooks.state.${p.id}`),
                  color: STATE_COLOR[p.id],
                  link: to({ status: p.id }),
                }))}
              />
              <BandLooks
                label={t("webhooks.band.listen")}
                looks={topAreas.map(([area, count]) => ({
                  id: area,
                  label: t(`webhooks.area.${area}`),
                  count,
                  link: to({ area }),
                }))}
              />
              <BandLooks
                label={t("machine.band.needsALook")}
                looks={[
                  {
                    id: "failing",
                    label: t("webhooks.looks.failing"),
                    count: states[1]?.count ?? 0,
                    danger: true,
                    link: to({ status: "failing" }),
                  },
                  {
                    id: "autoDisabled",
                    label: t("webhooks.looks.autoDisabled"),
                    count: states[2]?.count ?? 0,
                    danger: true,
                    link: to({ status: "autoDisabled" }),
                  },
                  {
                    id: "overlap",
                    label: t("webhooks.looks.overlap"),
                    count: all.filter((w) => overlapUntil(w, now)).length,
                    link: to({ look: "overlap" }),
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
          {hooksQ.isError ? (
            <DataState error={hooksQ.error} onRetry={() => void hooksQ.refetch()} />
          ) : (
            <>
              <Table<Webhook>
                label={t("webhooks.title")}
                rows={onPage}
                rowId={(w) => w.id}
                rowLabel={(w) => w.url}
                loading={hooksQ.isLoading}
                renderRowLink={(w) => <Link to="/developer/webhooks/$id" params={{ id: w.id }} />}
                columns={[
                  {
                    id: "url",
                    header: t("webhooks.columns.endpoint"),
                    primary: true,
                    cell: (w) => <Endpoint url={w.url} />,
                  },
                  {
                    id: "events",
                    header: t("webhooks.columns.listensTo"),
                    cell: (w) => {
                      const list = eventAreas(w.events);
                      const shown = list.slice(0, 2).map((a) => t(`webhooks.area.${a.area}`));
                      return (
                        <span className="dev-two">
                          <span>
                            {list.length > 2
                              ? t("webhooks.row.areasMore", {
                                  areas: shown.join(", "),
                                  n: list.length - 2,
                                })
                              : shown.join(", ")}
                          </span>
                          <small>
                            {t("webhooks.row.events", {
                              count: w.events.length,
                              n: n(w.events.length),
                            })}
                          </small>
                        </span>
                      );
                    },
                  },
                  {
                    id: "status",
                    header: t("webhooks.columns.status"),
                    cell: (w) => {
                      const line = stateLine(w, now);
                      return (
                        <span className="dev-two">
                          <span>
                            <WebhookBadge webhook={w} />
                          </span>
                          {line ? <small>{line}</small> : null}
                        </span>
                      );
                    },
                  },
                  {
                    id: "created",
                    header: t("webhooks.columns.created"),
                    numeric: true,
                    width: 140,
                    cell: (w) => <When at={w.created_at} now={now} />,
                  },
                ]}
                toolbar={
                  all.length ? (
                    <div className="ppl-toolbar">
                      <div className="ppl-filters">
                        <SearchField
                          ref={searchRef}
                          className="ppl-search"
                          aria-label={t("webhooks.search")}
                          placeholder={t("webhooks.searchPlaceholder")}
                          value={text}
                          onValueChange={setText}
                          onSearch={(q) => set({ q: q.trim() || undefined })}
                        />
                        <Select
                          aria-label={t("machine.filters.status")}
                          className="ppl-filter"
                          value={filters.status ?? ANY}
                          onValueChange={(v) =>
                            set({ status: v ? (String(v) as WebhookState) : undefined })
                          }
                          items={[
                            { value: ANY, label: t("machine.filters.anyStatus") },
                            ...states.map((p) => ({
                              value: p.id,
                              label: `${t(`webhooks.state.${p.id}`)} · ${n(p.count)}`,
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
                rowActions={
                  canWrite
                    ? (w) => (
                        <>
                          <MenuItem
                            icon={SendIcon}
                            disabled={!!w.disabled_at}
                            description={
                              w.disabled_at ? t("webhooks.actions.enableFirst") : undefined
                            }
                            onClick={() => actions.test(w)}
                          >
                            {t("webhooks.actions.test")}
                          </MenuItem>
                          <MenuItem icon={KeyRoundIcon} onClick={() => actions.rotate(w)}>
                            {t("webhooks.actions.rotate")}
                          </MenuItem>
                          <MenuSeparator />
                          {w.disabled_at ? (
                            <MenuItem icon={PowerIcon} onClick={() => actions.enable(w)}>
                              {t("webhooks.actions.enable")}
                            </MenuItem>
                          ) : (
                            <MenuItem
                              icon={PowerOffIcon}
                              tone="danger"
                              onClick={() => actions.disable(w)}
                            >
                              {t("webhooks.actions.disable")}
                            </MenuItem>
                          )}
                        </>
                      )
                    : undefined
                }
                empty={
                  all.length ? (
                    <EmptyState
                      size="section"
                      icon={WebhookIcon}
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
                      icon={WebhookIcon}
                      title={t("webhooks.empty.title")}
                      description={t("webhooks.empty.description")}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                            {t("webhooks.new")}
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
      {canWrite ? (
        <>
          <WebhookDrawer open={creating} onOpenChange={setCreating} />
          {actions.secretDrawer}
        </>
      ) : null}
    </>
  );
}
