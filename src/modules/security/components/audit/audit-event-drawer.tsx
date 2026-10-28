import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  formatNumber,
  Skeleton,
  Text,
} from "@qeetrix/react";
import {
  CodeBlock,
  CopyButton,
  DescriptionItem,
  DescriptionList,
  Timeline,
  TimelineItem,
} from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type ActivityEvent,
  categoryLabel,
  eventResult,
  formatEventTitle,
} from "@/modules/activity";
import { parseUserAgent } from "@/modules/users";
import type { AuditAnomaly } from "@/modules/security/api/audit-anomalies";
import { useAuditEvent } from "@/modules/security/api/audit-event";
import type { AuditEvent } from "@/modules/security/api/audit-log";
import { short } from "@/modules/security/audit-model";
import { whenText } from "../when";
import type { Person } from "../use-people";
import { ActorName, ResourceName, resourceLabel } from "./audit-cells";
import { ScoreBadge, reasonsText } from "./flagged-parts";

const RESULT_TONE = { failed: "danger", blocked: "warning" } as const;

function Mono({ value, label }: { value: string; label: string }) {
  return (
    <span className="sec-inline">
      <span className="sec-mono">{value}</span>
      <CopyButton value={value} label={label} size="sm" />
    </span>
  );
}

/**
 * One audit event, read in full, laid out as Activity's event drawer (the two become one once
 * both are merged: Activity owns the shared drawer): the title and date, its outcome and kind,
 * one fact list (Action, Actor, Resource, Address, Device, Request ID, Event ID), the details
 * Qeet ID recorded, the actor's other events around then, and the event as recorded. The audit
 * list leaves metadata out, so the details and related events come from the Activity API.
 */
export function AuditEventDrawer({
  eventId,
  row,
  flagged,
  people,
  now,
  onOpenChange,
  onActor,
  onResolve,
  resolving,
}: {
  eventId: string | undefined;
  row?: AuditEvent;
  flagged?: AuditAnomaly;
  people: ReadonlyMap<string, Person>;
  now: number;
  onOpenChange: (open: boolean) => void;
  onActor: (actorUserId: string) => void;
  onResolve?: (a: AuditAnomaly) => void;
  resolving?: boolean;
}) {
  const { t } = useTranslation("security");
  const locale = formatLocale();
  const details = useAuditEvent(eventId);
  const event = details.data?.event;
  const action = row?.action ?? event?.type ?? flagged?.action ?? "";
  const at = row?.created_at ?? event?.at ?? flagged?.event_at;
  const actorId = row?.actor_user_id ?? event?.actor?.id ?? flagged?.actor_user_id ?? undefined;
  const actor = actorId ? people.get(actorId) : undefined;
  const actorFirst =
    actor?.name.split(" ")[0] ??
    event?.actor?.name?.split(" ")[0] ??
    flagged?.actor_email ??
    undefined;
  const result = eventResult({
    severity: event?.severity ?? "info",
    type: action,
    status: event?.status,
  });
  const resultTone = result === "failed" || result === "blocked" ? RESULT_TONE[result] : undefined;
  const meta = Object.entries(event?.metadata ?? {}).filter(
    ([key, value]) =>
      !(key === "ip" && value === (row?.ip ?? event?.ip)) &&
      !(key === "user_agent" && value === row?.user_agent) &&
      value !== null &&
      value !== "",
  );
  const byActor = details.data?.related.by_actor ?? [];
  const byRequest = details.data?.related.by_request_id ?? [];
  const ip = row?.ip ?? event?.ip ?? flagged?.ip ?? undefined;
  const userAgent = row?.user_agent ?? undefined;
  const resourceType = row?.resource_type ?? event?.target?.type ?? flagged?.resource_type ?? "";
  const resourceId = row?.resource_id ?? event?.target?.id ?? undefined;
  const requestId = row?.request_id ?? event?.request_id ?? undefined;

  const relatedLine = (r: ActivityEvent) =>
    [
      r.target?.type ? `${resourceLabel(t, r.target.type)} ${short(r.target.id)}`.trim() : "",
      r.ip ?? "",
      r.browser ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <Drawer open={!!eventId} onOpenChange={onOpenChange}>
      {eventId ? (
        <DrawerContent
          size="md"
          title={action ? formatEventTitle({ type: action }) : t("audit.drawer.loading")}
          description={
            at
              ? `${formatDateTime(at, locale, { timeStyle: "medium" })} · ${whenText(at, now)}`
              : undefined
          }
        >
          <DrawerBody>
            <div className="sec-drawer">
              {resultTone || event?.category || flagged ? (
                <div className="sec-drawer-badges">
                  {resultTone ? (
                    <Badge tone={resultTone}>
                      {t(`audit.result.${result as "failed" | "blocked"}`)}
                    </Badge>
                  ) : null}
                  {event?.category ? <Badge>{categoryLabel(event.category)}</Badge> : null}
                  {flagged ? <ScoreBadge score={flagged.score} size="md" /> : null}
                </div>
              ) : null}
              {flagged ? (
                <Text size="sm" tone="subtle">
                  {t("audit.drawer.flaggedWhy", { reasons: reasonsText(t, flagged.reasons) })}
                </Text>
              ) : null}
              <DescriptionList>
                <DescriptionItem term={t("audit.drawer.action")}>
                  {action ? <Mono value={action} label={t("audit.drawer.copyAction")} /> : null}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.actor")}>
                  {row ? (
                    <ActorName event={row} people={people} inline />
                  ) : event?.actor?.name ? (
                    event.actor.name
                  ) : (
                    (flagged?.actor_email ?? "—")
                  )}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.resource")}>
                  {resourceType ? (
                    <span className="sec-stack">
                      <ResourceName type={resourceType} id={resourceId} people={people} />
                      {resourceId ? (
                        <Mono value={resourceId} label={t("audit.drawer.copyResource")} />
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.address")}>
                  {ip ? <span className="sec-mono">{ip}</span> : "—"}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.device")}>
                  {userAgent ? (
                    <span title={userAgent}>{parseUserAgent(userAgent).label}</span>
                  ) : (
                    (event?.browser ?? "—")
                  )}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.request")}>
                  {requestId ? (
                    <Mono value={requestId} label={t("audit.drawer.copyRequest")} />
                  ) : (
                    "—"
                  )}
                </DescriptionItem>
                <DescriptionItem term={t("audit.drawer.event")}>
                  <Mono value={eventId} label={t("audit.drawer.copyEvent")} />
                </DescriptionItem>
              </DescriptionList>

              {details.isLoading ? (
                <Skeleton lines={3} />
              ) : (
                <>
                  {meta.length ? (
                    <section className="sec-drawer-section">
                      <Text weight="semibold">{t("audit.drawer.details")}</Text>
                      <DescriptionList>
                        {meta.map(([key, value]) => (
                          <DescriptionItem key={key} term={key.replace(/_/g, " ")}>
                            <span className="sec-mono sec-wrap">
                              {typeof value === "string" ? value : JSON.stringify(value)}
                            </span>
                          </DescriptionItem>
                        ))}
                      </DescriptionList>
                    </section>
                  ) : null}
                  {actorId ? (
                    <section className="sec-drawer-section">
                      <Text weight="semibold">
                        {actorFirst
                          ? t("audit.drawer.byActor", { name: actorFirst })
                          : t("audit.drawer.byThisActor")}
                      </Text>
                      {byActor.length ? (
                        <Timeline variant="compact">
                          {byActor.map((r) => (
                            <TimelineItem
                              key={r.id}
                              title={formatEventTitle(r)}
                              description={relatedLine(r)}
                              time={whenText(r.at, now)}
                              dateTime={r.at}
                              tone={
                                r.severity === "critical" || r.severity === "error"
                                  ? "danger"
                                  : "neutral"
                              }
                            />
                          ))}
                        </Timeline>
                      ) : (
                        <Text size="sm" tone="subtle">
                          {details.isError
                            ? t("audit.drawer.relatedFailed")
                            : t("audit.drawer.noneNearby")}
                        </Text>
                      )}
                      <Text size="sm" tone="subtle">
                        {byRequest.length
                          ? t("audit.drawer.sameRequest", {
                              count: byRequest.length,
                              n: formatNumber(byRequest.length, locale),
                            })
                          : t("audit.drawer.noSameRequest")}
                      </Text>
                    </section>
                  ) : null}
                </>
              )}

              <section className="sec-drawer-section">
                <Text weight="semibold">{t("audit.drawer.recorded")}</Text>
                <CodeBlock
                  language="json"
                  title="JSON"
                  code={JSON.stringify(row ?? event ?? flagged ?? {}, null, 2)}
                />
              </section>
            </div>
          </DrawerBody>
          <DrawerFooter>
            {actorId ? (
              <Button variant="ghost" onClick={() => onActor(actorId)}>
                {actorFirst
                  ? t("audit.drawer.eventsBy", { name: actorFirst })
                  : t("audit.drawer.eventsByActor")}
              </Button>
            ) : null}
            <DrawerClose render={<Button variant="soft">{t("common.close")}</Button>} />
            {flagged && flagged.status === "open" && onResolve ? (
              <Button loading={resolving} onClick={() => onResolve(flagged)}>
                {t("audit.flagged.resolve")}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
