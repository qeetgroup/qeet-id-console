import { DownloadIcon, ShieldIcon, UserXIcon } from "@qeetrix/icons";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from "@qeetrix/react";
import { EmptyState, PageContent, PageHeader, PageHeaderBack } from "@qeetrix/react/experimental";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { roleQueries } from "@/modules/authorization";
import { type EventsQuery, timelineQueries } from "@/modules/timeline/api/timeline";
import { useTimelineExport } from "@/modules/timeline/timeline-export";
import {
  DEFAULT_PERIOD,
  eventsByDay,
  eventTitle,
  periodStart,
  sumSignIns,
  type TimelineSearch,
} from "@/modules/timeline/timeline-model";
import { userQueries } from "@/modules/users";
import { ApiError } from "@/platform/errors/api-error";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { TimelineBand, TimelineBandPlaceholder } from "./timeline-band";
import { TimelineEvents } from "./timeline-events";
import type { Names } from "./timeline-words";
import "./timeline-page.css";

// The most people an admin's page names in "Added Riya Sharma", read one by one.
const NAMED_PEOPLE = 25;

/**
 * A person's timeline: the period summed up in the header (events by day, sign-ins and how,
 * failures, where from), then every event by or about them, by day, each opening its record in
 * Activity. The period and filters live in the address. It reads the audit log (audit.read).
 */
export function PersonTimelinePage({
  userId,
  filters,
  onFiltersChange,
}: {
  userId: string;
  filters: TimelineSearch;
  onFiltersChange: (next: TimelineSearch) => void;
}) {
  const { t } = useTranslation("timeline");
  const access = useCapabilities();
  const canRead = access.can("audit.read");
  const tenantId = useTenantId();
  const enabled = canRead && !!tenantId;
  // The period counts back from when the page opened, so its queries keep one window.
  const [now] = useState(() => Date.now());
  const period = filters.period ?? DEFAULT_PERIOD;
  const start = periodStart(period, now);
  const from = start.toISOString();
  const query: EventsQuery = { from, kind: filters.kind, failed: filters.result === "failed" };

  const personQ = useQuery({ ...userQueries.detail(tenantId, userId), meta: { silent: true } });
  const summaryQ = useQuery({ ...timelineQueries.summary(tenantId, userId, from), enabled });
  const signInsQ = useQuery({ ...timelineQueries.signIns(tenantId, userId, from), enabled });
  const eventsQ = useInfiniteQuery({ ...timelineQueries.events(tenantId, userId, query), enabled });
  const exporter = useTimelineExport(userId, query);

  const events = useMemo(() => eventsQ.data?.pages.flatMap((p) => p.events) ?? [], [eventsQ.data]);
  const signIns = useMemo(() => sumSignIns(signInsQ.data?.events ?? []), [signInsQ.data]);
  const days = useMemo(
    () => eventsByDay(summaryQ.data?.series ?? [], period, now),
    [summaryQ.data, period, now],
  );

  // Names the events need: the roles given or taken, and the people an admin acted on.
  const titles = events.map((e) => eventTitle(e, userId));
  const hasRoles = titles.some((x) => (x.kind === "about" || x.kind === "toOther") && x.roleId);
  const rolesQ = useQuery({
    ...roleQueries.list(tenantId),
    enabled: !!tenantId && hasRoles && access.can("role.read"),
  });
  const others = [
    ...new Set(titles.flatMap((x) => (x.kind === "toOther" && x.personId ? [x.personId] : []))),
  ].slice(0, NAMED_PEOPLE);
  const othersQ = useQueries({
    queries: others.map((id) => ({ ...userQueries.detail(tenantId, id), staleTime: 60_000 })),
  });
  const names: Names = {
    role: (id) => (id ? rolesQ.data?.items.find((r) => r.id === id)?.name : undefined),
    person: (id) => {
      const q = othersQ[others.indexOf(id ?? "")];
      return q?.data?.display_name?.trim() || q?.data?.email || undefined;
    },
  };

  const gone = personQ.error instanceof ApiError && personQ.error.status === 404;
  const ownName = events.find((e) => e.actor?.id === userId)?.actor?.name;
  const person =
    personQ.data?.display_name?.trim() || personQ.data?.email || ownName || t("page.thisPerson");

  const back = gone ? (
    <PageHeaderBack render={<Link to="/users" />}>{t("page.users")}</PageHeaderBack>
  ) : (
    <PageHeaderBack render={<Link to="/users/$userId" params={{ userId }} />}>
      {person}
    </PageHeaderBack>
  );

  if (!canRead)
    return (
      <>
        <PageHeader back={back} title={t("page.title")} />
        <PageContent>
          <EmptyState
            icon={ShieldIcon}
            title={t("page.noAccessTitle")}
            description={t("page.noAccessDescription")}
          />
        </PageContent>
      </>
    );

  if (gone && !eventsQ.isLoading && events.length === 0 && !filters.kind && !filters.result)
    return (
      <>
        <PageHeader back={back} title={t("page.title")} />
        <PageContent>
          <EmptyState
            icon={UserXIcon}
            title={t("page.notFoundTitle")}
            description={t("page.notFoundDescription")}
            actions={
              <Button variant="soft" tone="neutral" render={<Link to="/users" />}>
                {t("page.backToUsers")}
              </Button>
            }
          />
        </PageContent>
      </>
    );

  return (
    <>
      <PageHeader
        back={back}
        title={t("page.title")}
        description={t("page.description", { name: person })}
        actions={
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="soft"
                  tone="neutral"
                  icon={DownloadIcon}
                  loading={!!exporter.exporting}
                >
                  {t("page.export")}
                </Button>
              }
            />
            <MenuContent align="end">
              <MenuItem onClick={() => void exporter.run("csv")}>{t("page.exportCsv")}</MenuItem>
              <MenuItem onClick={() => void exporter.run("json")}>{t("page.exportJson")}</MenuItem>
            </MenuContent>
          </Menu>
        }
        summary={
          summaryQ.data && signInsQ.data ? (
            <TimelineBand
              userId={userId}
              filters={filters}
              summary={summaryQ.data}
              days={days}
              signIns={signIns}
              capped={signInsQ.data.capped}
            />
          ) : summaryQ.isLoading || signInsQ.isLoading ? (
            <TimelineBandPlaceholder />
          ) : undefined
        }
      />
      <PageContent>
        <div className="tl-page">
          <TimelineEvents
            userId={userId}
            person={person}
            filters={filters}
            onFiltersChange={onFiltersChange}
            summary={summaryQ.data}
            from={start}
            events={events}
            loading={eventsQ.isLoading}
            error={eventsQ.error}
            onRetry={() => void eventsQ.refetch()}
            hasMore={eventsQ.hasNextPage}
            loadingMore={eventsQ.isFetchingNextPage}
            onMore={() => void eventsQ.fetchNextPage()}
            names={names}
            now={now}
          />
        </div>
      </PageContent>
    </>
  );
}
