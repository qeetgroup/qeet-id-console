// To be replaced by the timeline module's view (#92), user decision 2026-10-28.
import { ActivityIcon, DownloadIcon, ExternalLinkIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  formatRelativeTime,
  Select,
  Table,
  type TableColumn,
} from "@qeetrix/react";
import { CopyButton, EmptyState, Pagination } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  ACTIVITY_CATEGORIES,
  type ActivityEvent,
  categoryLabel,
  eventResult,
  formatEventTitle,
} from "@/modules/activity";
import {
  NO_ACTIVITY_FILTERS,
  type PersonActivityFilters,
  usePersonActivity,
} from "@/modules/users/api/person";
import type { UserDetail } from "@/modules/users/api/user360";
import { activityAt, signInMethod } from "@/modules/users/person-model";
import { errorMessage } from "@/platform/errors/user-message";
import { exportToCsv } from "@/shared/utils/data-export";
import { Fact, Facts } from "./person-parts";

const PAGE = 25;
const SINCE = ["", "24h", "7d", "30d"] as const;

const RESULT_TONE = {
  success: "success",
  failed: "danger",
  blocked: "danger",
  warning: "warning",
  info: "neutral",
} as const;

const failedOf = (e: ActivityEvent) => {
  const result = eventResult(e);
  return result === "failed" || result === "blocked";
};

/**
 * Activity (once the separate identity timeline): every event about the person, as actor or
 * target, newest first, 25 a page; filters narrow it at the server. No search: the audit log's
 * full-text index holds neither the words shown nor the addresses, so a search box would mislead. An event opens in
 * a drawer, and from there in Activity with everything around it.
 */
export function PersonActivity({
  user,
  first,
  canView,
}: {
  user: UserDetail;
  first: string;
  canView: boolean;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const [filters, setFilters] = useState<PersonActivityFilters>(NO_ACTIVITY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<ActivityEvent | null>(null);
  const query = usePersonActivity(user.id, filters, canView);
  const events = useMemo(() => query.data?.pages.flatMap((p) => p.events) ?? [], [query.data]);
  const onPage = events.slice(offset, offset + PAGE);
  const now = query.dataUpdatedAt || Date.now();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // A page past what's loaded reads the next one from the server.
  useEffect(() => {
    if (offset + PAGE > events.length && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [offset, events.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const set = (patch: Partial<PersonActivityFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setOffset(0);
  };

  if (!canView)
    return (
      <EmptyState
        size="section"
        icon={ActivityIcon}
        title={t("person.activity.restrictedTitle")}
        description={t("person.activity.restricted", { name: first })}
      />
    );

  const columns: TableColumn<ActivityEvent>[] = [
    {
      id: "event",
      header: t("person.activity.event"),
      primary: true,
      cell: (e) => (
        <span className="prs-event-title">
          {formatEventTitle(e)}
          {failedOf(e) ? (
            <Badge tone="danger" size="sm">
              {t("person.activity.failed")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: "kind",
      header: t("person.activity.kind"),
      width: 140,
      cell: (e) => categoryLabel(e.category),
    },
    {
      id: "device",
      header: t("person.activity.device"),
      width: 140,
      cell: (e) => e.device || e.browser || "—",
    },
    {
      id: "ip",
      header: t("person.activity.ip"),
      width: 150,
      cell: (e) => <span className="prs-mono">{e.ip || "—"}</span>,
    },
    {
      id: "when",
      header: t("person.activity.when"),
      numeric: true,
      width: 140,
      cell: (e) => (
        <time dateTime={e.at} title={formatDateTime(e.at, locale)}>
          {formatRelativeTime(Math.min(Date.parse(e.at), now), locale, now)}
        </time>
      ),
    },
  ];

  const filtered = !!(filters.since || filters.category || filters.failed);

  return (
    <>
      <Table<ActivityEvent>
        label={t("person.activity.label", { name: first })}
        rows={onPage}
        rowId={(e) => e.id}
        rowLabel={formatEventTitle}
        columns={columns}
        loading={query.isLoading || (isFetchingNextPage && !onPage.length)}
        onRowClick={setOpen}
        toolbar={
          <div className="ppl-toolbar">
            <div className="ppl-filters">
              <Select
                className="ppl-filter"
                aria-label={t("person.activity.since")}
                value={filters.since}
                onValueChange={(value) =>
                  set({ since: (value ?? "") as PersonActivityFilters["since"] })
                }
                items={SINCE.map((s) => ({
                  value: s,
                  label: t(`person.activity.sinceOptions.${s || "any"}`),
                }))}
              />
              <Select
                className="ppl-filter"
                aria-label={t("person.activity.kind")}
                value={filters.category}
                onValueChange={(value) => set({ category: String(value ?? "") })}
                items={[
                  { value: "", label: t("person.activity.anyKind") },
                  ...ACTIVITY_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
                ]}
              />
              <Select
                className="ppl-filter"
                aria-label={t("person.activity.result")}
                value={filters.failed ? "failed" : ""}
                onValueChange={(value) => set({ failed: value === "failed" })}
                items={[
                  { value: "", label: t("person.activity.anyResult") },
                  { value: "failed", label: t("person.activity.failedOnly") },
                ]}
              />
              <Button
                variant="ghost"
                icon={DownloadIcon}
                disabled={!events.length}
                onClick={() =>
                  exportToCsv(`activity-${user.email}`, events, [
                    { header: "at", value: (e) => e.at },
                    { header: "event", value: (e) => formatEventTitle(e) },
                    { header: "type", value: (e) => e.type },
                    { header: "category", value: (e) => e.category },
                    { header: "result", value: (e) => eventResult(e) },
                    { header: "ip", value: (e) => e.ip ?? "" },
                    { header: "device", value: (e) => e.device || e.browser || "" },
                    { header: "id", value: (e) => e.id },
                  ])
                }
              >
                {t("person.activity.export")}
              </Button>
            </div>
          </div>
        }
        empty={
          <EmptyState
            size="section"
            icon={ActivityIcon}
            title={filtered ? t("person.activity.noneFiltered") : t("person.activity.none")}
            description={
              filtered
                ? t("person.activity.noneFilteredNote")
                : t("person.activity.noneNote", { name: first })
            }
          />
        }
        error={
          query.isError ? (
            <EmptyState
              size="section"
              icon={ActivityIcon}
              tone="danger"
              title={t("person.loadFailed")}
              description={errorMessage(query.error)}
              actions={
                <Button size="sm" variant="soft" onClick={() => void query.refetch()}>
                  {t("person.tryAgain")}
                </Button>
              }
            />
          ) : undefined
        }
      />
      {events.length ? (
        <Pagination
          offset={offset}
          pageSize={PAGE}
          itemsOnPage={onPage.length}
          total={hasNextPage ? undefined : events.length}
          loading={isFetchingNextPage}
          onOffsetChange={setOffset}
        />
      ) : null}
      <EventDrawer event={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** One event: what happened, its result, how and from where, who, and its IDs. */
function EventDrawer({ event, onClose }: { event: ActivityEvent | null; onClose: () => void }) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const method = event?.metadata?.method;
  return (
    <Drawer open={!!event} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent
        title={event ? formatEventTitle(event) : ""}
        description={event ? formatDateTime(event.at, locale, { dateStyle: "long" }) : undefined}
        size="md"
      >
        {event ? (
          <>
            <DrawerBody>
              <Facts>
                <Fact label={t("person.activity.result")}>
                  <Badge tone={RESULT_TONE[eventResult(event)]} size="sm">
                    {t(`person.activity.results.${eventResult(event)}`)}
                  </Badge>
                </Fact>
                <Fact label={t("person.activity.kind")}>{categoryLabel(event.category)}</Fact>
                {typeof method === "string" ? (
                  <Fact
                    label={t("person.activity.method")}
                    hint={
                      signInMethod(method).secondStep ? t("person.activity.withStep") : undefined
                    }
                  >
                    {t(`person.methods.${signInMethod(method).method}`)}
                  </Fact>
                ) : null}
                {event.actor?.name ? (
                  <Fact label={t("person.activity.who")}>{event.actor.name}</Fact>
                ) : null}
                {event.ip ? (
                  <Fact label={t("person.activity.ip")} hint={event.location || undefined}>
                    <span className="prs-mono">{event.ip}</span>
                  </Fact>
                ) : null}
                {event.device || event.browser ? (
                  <Fact label={t("person.activity.device")}>{event.device || event.browser}</Fact>
                ) : null}
                <Fact label={t("person.activity.type")}>
                  <span className="prs-mono">{event.type}</span>
                </Fact>
                <Fact
                  label={t("person.activity.id")}
                  action={
                    <CopyButton value={event.id} label={t("person.activity.copyId")} size="sm" />
                  }
                >
                  <span className="prs-mono">{event.id}</span>
                </Fact>
              </Facts>
            </DrawerBody>
            <DrawerFooter>
              <Button
                variant="soft"
                tone="neutral"
                icon={ExternalLinkIcon}
                render={<RouterLink to="/activity" search={activityAt(event)} />}
              >
                {t("person.activity.open")}
              </Button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
