import { SearchXIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  formatRelativeTime,
  Link,
  Skeleton,
  Text,
} from "@qeetrix/react";
import {
  CodeBlock,
  CopyButton,
  DataState,
  DescriptionItem,
  DescriptionList,
  EmptyState,
  Timeline,
  TimelineItem,
  type TimelineTone,
} from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { type ReactElement, useRef } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { eventActor, firstName } from "@/modules/activity/activity-view";
import { categoryLabel, formatEventTitle, resourceLabel } from "@/modules/activity/event-labels";
import { useRelatedEvents } from "@/modules/activity/related-events";
import type { ActivityEvent, Severity } from "@/modules/activity/types/activity.types";
import { SeverityBadge } from "../severity-badge";
import "./event-drawer.css";

export interface ActivityEventDrawerProps {
  /**
   * The event to show; null closes the drawer. Any audit event's ID works: Activity and Security ›
   * Audit logs read the same records, so both open their events here.
   */
  eventId: string | null;
  /** The event as the list already has it, so the drawer shows at once while its record loads. */
  event?: ActivityEvent | null;
  onClose: () => void;
  /** Opens a related event in this one's place. Without it, related events aren't links. */
  onOpenEvent?: (id: string) => void;
  /** "Events by Priya": the list narrowed to the actor. Without it, there's no such action. */
  onShowActorEvents?: (actor: { id: string; name?: string }) => void;
}

const TIMELINE_TONE: Record<Severity, TimelineTone> = {
  info: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
  critical: "danger",
};

/**
 * One event, read in full, for Activity and Security › Audit logs alike: its outcome and why,
 * the facts in one ruled list (action, actor, resource, address, device, request and event IDs),
 * the details Qeet ID recorded, the events around it, and the record as JSON. Opened by ID, it
 * reads the event from the server, so a link to an event works wherever it isn't loaded.
 */
export function ActivityEventDrawer({
  eventId,
  event: listed,
  onClose,
  onOpenEvent,
  onShowActorEvents,
}: ActivityEventDrawerProps) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const recordQ = useRelatedEvents(eventId);
  const fresh =
    recordQ.data?.event ?? (listed && listed.id === eventId ? listed : undefined) ?? undefined;
  // What was on show stays while the drawer slides away.
  const lastRef = useRef<ActivityEvent | undefined>(undefined);
  if (fresh) lastRef.current = fresh;
  const event = eventId ? fresh : lastRef.current;
  const actor = event ? eventActor(event) : undefined;
  const now = recordQ.dataUpdatedAt || Date.now();

  return (
    <Drawer open={!!eventId} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        size="md"
        title={event ? formatEventTitle(event) : t("drawer.loading")}
        description={
          event
            ? t("drawer.when", {
                date: formatDateTime(event.at, locale, { timeStyle: "medium" }),
                ago: formatRelativeTime(Math.min(Date.parse(event.at), now), locale, now),
              })
            : undefined
        }
      >
        <DrawerBody>
          {event ? (
            <EventRecord
              event={event}
              related={recordQ.data?.related}
              relatedLoading={recordQ.isLoading}
              onOpenEvent={onOpenEvent}
              now={now}
            />
          ) : recordQ.isError ? (
            <DataState error={recordQ.error} onRetry={() => recordQ.refetch()} />
          ) : recordQ.data === null ? (
            <EmptyState
              size="section"
              icon={SearchXIcon}
              title={t("drawer.notFound.title")}
              description={t("drawer.notFound.body")}
            />
          ) : (
            <div className="act-drawer" aria-busy="true">
              <Skeleton lines={3} />
              <Skeleton variant="block" className="act-drawer-skeleton" />
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          {actor?.personId && onShowActorEvents ? (
            <Button
              variant="ghost"
              onClick={() =>
                actor.personId && onShowActorEvents({ id: actor.personId, name: actor.personName })
              }
            >
              {t("drawer.actorEvents", { name: firstName(actor.personName ?? actor.name) })}
            </Button>
          ) : null}
          <DrawerClose render={<Button variant="soft">{t("drawer.close")}</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** A record's page for the resource, where the console has one. */
function resourceLink(
  type: string | undefined,
  id: string | undefined,
): ReactElement<Record<string, unknown>> | undefined {
  if (!type || !id) return undefined;
  switch (type.toLowerCase()) {
    case "user":
      return <RouterLink to="/users/$userId" params={{ userId: id }} />;
    case "group":
      return <RouterLink to="/groups/$groupId" params={{ groupId: id }} />;
    case "tenant":
      return <RouterLink to="/organizations/$orgId" params={{ orgId: id }} />;
    case "webhook":
    case "webhook_subscription":
      return <RouterLink to="/developer/webhooks/$id" params={{ id }} />;
    case "oidc_client":
      return <RouterLink to="/auth/connections/oidc/$clientId" params={{ clientId: id }} />;
    default:
      return undefined;
  }
}

/** A value in code type with its copy button. */
function Copyable({ value, label }: { value: string; label: string }) {
  return (
    <span className="act-copy">
      <Text mono size="sm" className="act-break">
        {value}
      </Text>
      <CopyButton value={value} label={label} size="sm" />
    </span>
  );
}

// Abbreviations a details key spells in capitals.
const CAPS = new Set(["id", "ip", "mfa", "url", "otp", "ua", "sso", "saml", "oidc", "scim", "api"]);

/** A details key in words: "refresh_token_id" is "Refresh token ID". */
function keyWords(key: string): string {
  const words = key
    .split(/[_.\s-]+/)
    .filter(Boolean)
    .map((w) => (CAPS.has(w.toLowerCase()) ? w.toUpperCase() : w.toLowerCase()));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A details value as text: lists joined, anything nested as compact JSON. */
function valueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v !== "object" || v === null))
    return value.map(String).join(", ");
  return JSON.stringify(value);
}

function EventRecord({
  event,
  related,
  relatedLoading,
  onOpenEvent,
  now,
}: {
  event: ActivityEvent;
  related?: { by_request_id: ActivityEvent[]; by_actor: ActivityEvent[] };
  relatedLoading: boolean;
  onOpenEvent?: (id: string) => void;
  now: number;
}) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const actor = eventActor(event);
  const target = event.target;
  const link = resourceLink(target?.type, target?.id);
  const device = event.browser ?? event.device;
  // The details, less what the facts above already say.
  const details = Object.entries(event.metadata ?? {}).filter(
    ([key, value]) =>
      !(key === "ip" && value === event.ip) &&
      !(key === "session_id" && value === target?.id) &&
      !(key === "user_agent" && value === device),
  );
  const byActor = related?.by_actor ?? [];
  const byRequest = related?.by_request_id ?? [];

  const relatedItem = (r: ActivityEvent) => {
    const title = formatEventTitle(r);
    const where = [
      r.target?.type ? resourceLabel(r.target.type) : "",
      r.ip ?? "",
      r.browser ?? "",
    ].filter(Boolean);
    return (
      <TimelineItem
        key={r.id}
        title={
          onOpenEvent ? (
            <Link
              render={<button type="button" />}
              className="act-related-link"
              aria-label={t("drawer.openEvent", { title })}
              onClick={() => onOpenEvent(r.id)}
            >
              {title}
            </Link>
          ) : (
            title
          )
        }
        description={where.join(" · ") || undefined}
        time={formatRelativeTime(Math.min(Date.parse(r.at), now), locale, now)}
        dateTime={r.at}
        tone={TIMELINE_TONE[r.severity] ?? "neutral"}
      />
    );
  };

  return (
    <div className="act-drawer">
      <div className="act-drawer-head">
        <span className="act-drawer-badges">
          <SeverityBadge severity={event.severity} size="md" />
          <Badge tone="neutral">{categoryLabel(event.category)}</Badge>
        </span>
        <Text size="sm" tone="subtle" render={<p />} className="act-drawer-why">
          {t(`drawer.why.${event.severity in TIMELINE_TONE ? event.severity : "info"}`)}
        </Text>
      </div>

      <DescriptionList>
        <DescriptionItem term={t("drawer.facts.action")}>
          <Copyable value={event.type} label={t("drawer.copyAction")} />
        </DescriptionItem>
        <DescriptionItem term={t("drawer.facts.actor")}>
          {actor.system && actor.personName ? (
            t("drawer.actorSystem", { name: actor.personName })
          ) : actor.personId && actor.personName ? (
            <Link render={<RouterLink to="/users/$userId" params={{ userId: actor.personId }} />}>
              {actor.note
                ? t("drawer.actorKind", { name: actor.name, kind: actor.note })
                : actor.name}
            </Link>
          ) : actor.note ? (
            t("drawer.actorKind", { name: actor.name, kind: actor.note })
          ) : (
            actor.name
          )}
        </DescriptionItem>
        <DescriptionItem term={t("drawer.facts.resource")}>
          {target?.type ? (
            <span className="act-drawer-pair">
              {link ? (
                <Link render={link}>{target.label ?? resourceLabel(target.type)}</Link>
              ) : (
                <span>{target.label ?? resourceLabel(target.type)}</span>
              )}
              {target.id ? <Copyable value={target.id} label={t("drawer.copyResourceId")} /> : null}
            </span>
          ) : null}
        </DescriptionItem>
        <DescriptionItem term={t("drawer.facts.address")}>
          {event.ip ? <Copyable value={event.ip} label={t("drawer.copyAddress")} /> : null}
        </DescriptionItem>
        <DescriptionItem term={t("drawer.facts.device")}>{device}</DescriptionItem>
        <DescriptionItem term={t("drawer.facts.requestId")}>
          {event.request_id ? (
            <Copyable value={event.request_id} label={t("drawer.copyRequestId")} />
          ) : null}
        </DescriptionItem>
        <DescriptionItem term={t("drawer.facts.eventId")}>
          <Copyable value={event.id} label={t("drawer.copyEventId")} />
        </DescriptionItem>
      </DescriptionList>

      {details.length ? (
        <section className="act-drawer-section" aria-labelledby="act-drawer-details">
          <h3 className="act-drawer-title" id="act-drawer-details">
            {t("drawer.details")}
          </h3>
          <DescriptionList>
            {details.map(([key, value]) => (
              <DescriptionItem key={key} term={keyWords(key)}>
                {valueText(value) ? (
                  <Text mono size="sm" className="act-break">
                    {valueText(value)}
                  </Text>
                ) : null}
              </DescriptionItem>
            ))}
          </DescriptionList>
        </section>
      ) : null}

      {relatedLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {byRequest.length ? (
            <section className="act-drawer-section" aria-labelledby="act-drawer-request">
              <h3 className="act-drawer-title" id="act-drawer-request">
                {t("drawer.sameRequest")}
              </h3>
              <Timeline variant="compact">{byRequest.map(relatedItem)}</Timeline>
            </section>
          ) : null}
          {byActor.length ? (
            <section className="act-drawer-section" aria-labelledby="act-drawer-actor">
              <h3 className="act-drawer-title" id="act-drawer-actor">
                {t("drawer.byActor", { name: firstName(actor.personName ?? actor.name) })}
              </h3>
              <Timeline variant="compact">{byActor.map(relatedItem)}</Timeline>
              {event.request_id && !byRequest.length ? (
                <Text size="sm" tone="subtle" render={<p />} className="act-drawer-note">
                  {t("drawer.noSameRequest")}
                </Text>
              ) : null}
            </section>
          ) : null}
        </>
      )}

      <section className="act-drawer-section" aria-labelledby="act-drawer-raw">
        <h3 className="act-drawer-title" id="act-drawer-raw">
          {t("drawer.raw")}
        </h3>
        <CodeBlock
          language="json"
          title={t("drawer.rawTitle")}
          code={JSON.stringify(event, null, 2)}
        />
      </section>
    </div>
  );
}
