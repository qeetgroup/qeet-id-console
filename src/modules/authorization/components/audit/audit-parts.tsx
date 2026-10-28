import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
} from "@qeetrix/react";
import {
  AvatarItem,
  CopyButton,
  DescriptionItem,
  DescriptionList,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { RelatedEventsResponse } from "@/modules/activity";
import {
  type ActivityEvent,
  CHANGE_KINDS,
  type ChangeKind,
  type useAuthzSummary,
} from "@/modules/authorization/api/authz-activity";
import { authzKeys } from "@/modules/authorization/api/keys";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useCount } from "../lists/authz-parts";
import { actorName, type ChangeContext, changeTarget, titleText } from "./change-model";

// The Users band's ordinal ramp (people.css), a step per kind.
const SWATCH: Record<ChangeKind, string> = {
  policies: "today",
  roles: "week",
  groupRoles: "month",
  relationships: "older",
};

/**
 * The band: changes over the last 90 days, what kind they were, and how many people made them
 * (the activity summary's window). Each kind opens the list filtered to it.
 */
export function AuditBand({ summary }: { summary: ReturnType<typeof useAuthzSummary> }) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const all = summary.all;
  if (!all) return null;
  const series = all.series.map((b) => b.count);
  const kinds = CHANGE_KINDS.map((id) => ({ id, count: summary.byKind[id] ?? 0 }));
  return (
    <dl className="ppl-band is-three">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.audit.band.changes")}</dt>
        <dd className="ppl-value">{n(all.total)}</dd>
        <dd className="ppl-note">{t("lists.audit.band.changesNote")}</dd>
        {series.length > 1 ? (
          <dd className="ppl-chart">
            <span
              role="img"
              aria-label={t("lists.audit.band.seriesLabel", {
                from: n(Math.min(...series)),
                to: n(Math.max(...series)),
              })}
            >
              <Sparkline values={series} width={132} height={40} />
            </span>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.audit.band.kinds")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={kinds.map((k) => `${t(`lists.audit.kinds.${k.id}`)}: ${n(k.count)}`).join(", ")}
            parts={kinds.map((k) => ({ value: k.count, color: `var(--ppl-${SWATCH[k.id]})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {kinds.map((k) => (
              <li key={k.id} className={k.count ? undefined : "is-zero"}>
                <RouterLink to="/authorization/audit" search={{ kind: k.id }}>
                  <span className={`ppl-swatch is-${SWATCH[k.id]}`} aria-hidden="true" />
                  <b>{n(k.count)}</b> {t(`lists.audit.kinds.${k.id}`).toLowerCase()}
                </RouterLink>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.audit.band.people")}</dt>
        <dd className="ppl-value">{n(all.unique_actors)}</dd>
        <dd className="ppl-note">
          {t("lists.audit.band.peopleNote", { count: all.unique_actors })}
        </dd>
      </div>
    </dl>
  );
}

/**
 * A change opened: when, who, from where, the event's own name and IDs, and a way to its record.
 * A link to a change that isn't loaded reads it from the server.
 */
export function ChangeDrawer({
  eventId,
  loaded,
  ctx,
  onClose,
}: {
  eventId?: string;
  loaded?: ActivityEvent;
  ctx: ChangeContext;
  onClose: () => void;
}) {
  const tenantId = useTenantId();
  const fetched = useQuery({
    queryKey: [...authzKeys.tenant(tenantId), "change", eventId],
    enabled: !!eventId && !loaded,
    queryFn: () => api<RelatedEventsResponse>(`/v1/activity/${eventId}/related`),
    meta: { silent: true },
  });
  const event = loaded ?? fetched.data?.event;
  return (
    <Drawer open={!!eventId && !!event} onOpenChange={(o) => !o && onClose()}>
      {event ? <ChangeDrawerContent event={event} ctx={ctx} /> : null}
    </Drawer>
  );
}

function ChangeDrawerContent({ event, ctx }: { event: ActivityEvent; ctx: ChangeContext }) {
  const { t } = useTranslation("authorization");
  const locale = formatLocale();
  const target = changeTarget(event, ctx);
  const name = actorName(event, ctx);
  const isPolicy = event.type.startsWith("abac_policy.");
  return (
    <DrawerContent
      title={titleText(event)}
      description={target.role ? `${target.role} · ${target.label}` : target.label}
      size="md"
    >
      <DrawerBody>
        <DescriptionList className="authz-facts">
          <DescriptionItem term={t("lists.audit.drawer.when")}>
            {formatDateTime(event.at, locale, { timeStyle: "medium" })}
          </DescriptionItem>
          <DescriptionItem term={t("lists.audit.drawer.by")}>
            {name ? <AvatarItem name={name} size="sm" /> : t("lists.common.system")}
          </DescriptionItem>
          <DescriptionItem term={t("lists.audit.drawer.from")}>
            <span className="authz-two">
              <span className="authz-mono">{event.ip || "—"}</span>
              {event.browser ? <small>{event.browser}</small> : null}
            </span>
          </DescriptionItem>
          <DescriptionItem term={t("lists.audit.drawer.event")}>
            <span className="authz-mono">{event.type}</span>
          </DescriptionItem>
          {event.target?.id ? (
            <DescriptionItem term={t("lists.audit.drawer.resourceId")}>
              <span className="authz-inline">
                <span className="authz-mono">{event.target.id}</span>
                <CopyButton
                  value={event.target.id}
                  label={t("lists.audit.drawer.copyResourceId")}
                  size="sm"
                />
              </span>
            </DescriptionItem>
          ) : null}
          {event.request_id ? (
            <DescriptionItem term={t("lists.audit.drawer.requestId")}>
              <span className="authz-mono">{event.request_id}</span>
            </DescriptionItem>
          ) : null}
        </DescriptionList>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose render={<Button variant="ghost">{t("lists.common.close")}</Button>} />
        {target.link ? (
          <Button variant="soft" render={<RouterLink {...target.link} />}>
            {t(
              target.link.to === "/groups/$groupId"
                ? "lists.audit.drawer.openGroup"
                : target.link.to === "/users/$userId"
                  ? "lists.audit.drawer.openPerson"
                  : "lists.audit.drawer.openRole",
            )}
          </Button>
        ) : isPolicy && event.type !== "abac_policy.deleted" ? (
          <Button variant="soft" render={<RouterLink to="/authorization/abac" />}>
            {t("lists.versions.drawer.openAbac")}
          </Button>
        ) : null}
      </DrawerFooter>
    </DrawerContent>
  );
}
