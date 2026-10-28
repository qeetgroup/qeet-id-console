import {
  CopyIcon,
  EllipsisIcon,
  KeyRoundIcon,
  PowerIcon,
  PowerOffIcon,
  RotateCwIcon,
  SendIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import {
  Button,
  formatRelativeTime,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Select,
  Skeleton,
  Table,
} from "@qeetrix/react";
import {
  CopyButton,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb } from "@/modules/dashboard";
import { ApiError } from "@/platform/api/client";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useRetryWebhookDelivery } from "@/modules/developer/api/webhook-actions";
import {
  useWebhook,
  useWebhookDeliveries,
  useWebhookEvents,
  type WebhookDelivery,
} from "@/modules/developer/api/webhooks";
import {
  countOutcomes,
  DELIVERY_LIMIT,
  endpointParts,
  type Outcome,
  OUTCOMES,
  outcomeOf,
} from "@/modules/developer/webhook-state";
import { DevSection, useNumbers, When } from "../parts";
import { DeliveryDrawer } from "./delivery-drawer";
import { DeliveryHealth } from "./delivery-health";
import { OutcomeBadge, useDeliveryWords } from "./delivery-parts";
import { useWebhookActions } from "./use-webhook-actions";
import { StateNotice } from "./webhook-notice";
import { WebhookBadge } from "./webhook-parts";
import { EventsSection, SecretSection } from "./webhook-sections";
import "../developer.css";

const ALL = "all";
const PAGE = 25;

/**
 * A webhook's page: its record. The header has its endpoint and state, with its delivery numbers
 * in the band; then what only it has: how its deliveries went day by day, the recent deliveries
 * (each opens with its request and the endpoint's answer), the events it gets, and its signing
 * secret with how to check a delivery.
 */
export function WebhookPage({ id }: { id: string }) {
  const { t } = useTranslation(["developer", "common"]);
  const { locale, n } = useNumbers();
  const access = useCapabilities();
  const canWrite = access.can("webhook.write");
  const hookQ = useWebhook(id);
  const deliveriesQ = useWebhookDeliveries(id);
  const eventsQ = useWebhookEvents();
  const actions = useWebhookActions();
  const retryM = useRetryWebhookDelivery();
  const words = useDeliveryWords();
  const [show, setShow] = useState<Outcome | typeof ALL>(ALL);
  const [open, setOpen] = useState<WebhookDelivery | null>(null);
  const [offset, setOffset] = useState(0);

  const w = hookQ.data;
  const now = hookQ.dataUpdatedAt || Date.now();
  if (hookQ.isLoading)
    return (
      <PageContent>
        <Skeleton lines={8} />
      </PageContent>
    );
  if (!w)
    return (
      <PageContent>
        {hookQ.isError && !isNotFound(hookQ.error) ? (
          <DataState error={hookQ.error} onRetry={() => void hookQ.refetch()} />
        ) : (
          <EmptyState
            icon={WebhookIcon}
            title={t("webhook.notFound")}
            description={t("webhook.notFoundDescription")}
            actions={
              <Button variant="soft" render={<RouterLink to="/developer/webhooks" />}>
                {t("webhook.backToList")}
              </Button>
            }
          />
        )}
      </PageContent>
    );

  const deliveries = deliveriesQ.data?.items ?? [];
  const counts = countOutcomes(deliveries, w);
  const off = !!w.disabled_at;
  const { host } = endpointParts(w.url);
  const toGo = counts.retrying + counts.queued + counts.held;
  const delivered = deliveries.length
    ? Math.round((counts.delivered / deliveries.length) * 100)
    : 0;
  const firstTry = deliveries.filter((d) => d.delivered_at && d.attempt <= 1).length;
  const shown = show === ALL ? deliveries : deliveries.filter((d) => outcomeOf(d, w) === show);
  const retry = (d: WebhookDelivery) => retryM.mutate({ webhookId: w.id, deliveryId: d.id });
  const retriable = (d: WebhookDelivery) => {
    const o = outcomeOf(d, w);
    return o === "delivered" || o === "gaveUp" || o === "retrying";
  };
  const catalogue = eventsQ.data?.items ?? [];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={host}
        status={<WebhookBadge webhook={w} size="md" />}
        description={
          <span className="dev-url">
            <code>{w.url}</code>
            <CopyButton value={w.url} label={t("webhook.copyUrl")} size="sm" variant="ghost" />
          </span>
        }
        actions={
          canWrite ? (
            <>
              {off ? (
                <Button icon={PowerIcon} onClick={() => actions.enable(w)}>
                  {t("webhooks.actions.enable")}
                </Button>
              ) : (
                <Button variant="soft" icon={SendIcon} onClick={() => actions.test(w)}>
                  {t("webhooks.actions.test")}
                </Button>
              )}
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      icon={EllipsisIcon}
                      aria-label={t("webhook.more")}
                      variant="ghost"
                      tone="neutral"
                    />
                  }
                />
                <MenuContent align="end">
                  <MenuItem icon={KeyRoundIcon} onClick={() => actions.rotate(w)}>
                    {t("webhooks.actions.rotate")}
                  </MenuItem>
                  {!off ? (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        icon={PowerOffIcon}
                        tone="danger"
                        onClick={() => actions.disable(w)}
                      >
                        {t("webhooks.actions.disable")}
                      </MenuItem>
                    </>
                  ) : null}
                </MenuContent>
              </Menu>
            </>
          ) : undefined
        }
        summary={
          deliveriesQ.data ? (
            <dl className="ppl-band dev-record-band">
              <div className="ppl-cell">
                <dt className="ppl-label">{t("webhook.band.delivered")}</dt>
                <dd className="ppl-value">
                  {deliveries.length ? t("webhook.band.percent", { n: delivered }) : "—"}
                </dd>
                <dd className="ppl-note">
                  {deliveries.length
                    ? t("webhook.band.deliveredNote", {
                        n: n(counts.delivered),
                        total: n(deliveries.length),
                        first: n(firstTry),
                      })
                    : t("webhook.band.noDeliveries")}
                </dd>
              </div>
              <div className="ppl-cell">
                <dt className="ppl-label">{t("webhook.band.toGo")}</dt>
                <dd className="ppl-value">{n(toGo)}</dd>
                <dd className={counts.held ? "ppl-note is-warning" : "ppl-note"}>
                  {counts.held
                    ? t("webhook.band.held", { n: n(counts.held) })
                    : counts.retrying
                      ? t("webhook.band.retrying", { n: n(counts.retrying) })
                      : t("webhook.band.nothingWaiting")}
                </dd>
              </div>
              <div className="ppl-cell">
                <dt className="ppl-label">{t("webhook.band.gaveUp")}</dt>
                <dd className="ppl-value">{n(counts.gaveUp)}</dd>
                <dd className="ppl-note">{t("webhook.band.gaveUpNote", { max: 60 })}</dd>
              </div>
              <div className="ppl-cell">
                <dt className="ppl-label">{t("webhook.band.events")}</dt>
                <dd className="ppl-value">{n(w.events.length)}</dd>
                <dd className="ppl-note">
                  {t("webhook.band.created", {
                    date: new Date(w.created_at).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }),
                  })}
                </dd>
              </div>
            </dl>
          ) : undefined
        }
      />
      <PageContent>
        <div className="dev-record">
          <StateNotice webhook={w} now={now} counts={counts} />

          <DevSection
            id="wh-health"
            title={t("webhook.health.title")}
            note={t("webhook.health.note")}
          >
            {deliveriesQ.isLoading ? (
              <Skeleton lines={3} />
            ) : deliveriesQ.isError ? (
              <DataState error={deliveriesQ.error} onRetry={() => void deliveriesQ.refetch()} />
            ) : deliveries.length ? (
              <DeliveryHealth deliveries={deliveries} webhook={w} now={now} />
            ) : (
              <p className="dev-section-note">{t("webhook.health.none")}</p>
            )}
          </DevSection>

          <DevSection
            id="wh-deliveries"
            title={t("webhook.deliveries.title")}
            note={
              deliveries.length >= DELIVERY_LIMIT
                ? t("webhook.deliveries.noteLimit", { n: DELIVERY_LIMIT })
                : t("webhook.deliveries.note")
            }
            action={
              deliveries.length ? (
                <Select
                  aria-label={t("webhook.deliveries.show")}
                  className="dev-show"
                  value={show}
                  onValueChange={(v) => {
                    setShow((v as Outcome | typeof ALL) ?? ALL);
                    setOffset(0);
                  }}
                  items={[
                    { value: ALL, label: t("webhook.deliveries.all", { n: n(deliveries.length) }) },
                    ...OUTCOMES.filter((o) => counts[o]).map((o) => ({
                      value: o,
                      label: `${t(`delivery.outcome.${o}`)} · ${n(counts[o])}`,
                    })),
                  ]}
                />
              ) : undefined
            }
          >
            {deliveries.length || deliveriesQ.isLoading ? (
              <Table<WebhookDelivery>
                label={t("webhook.deliveries.title")}
                rows={shown.slice(offset, offset + PAGE)}
                rowId={(d) => d.id}
                rowLabel={(d) =>
                  t("webhook.deliveries.rowLabel", {
                    event: d.event_type,
                    when: formatRelativeTime(Date.parse(d.created_at), locale, now),
                  })
                }
                loading={deliveriesQ.isLoading}
                onRowClick={setOpen}
                columns={[
                  {
                    id: "event",
                    header: t("webhook.deliveries.columns.event"),
                    primary: true,
                    cell: (d) => (
                      <span className="dev-name">
                        <code className="dev-strong-code">{d.event_type}</code>
                        <span className="dev-ident">
                          <code>{t("webhook.deliveries.short", { id: d.id.slice(0, 8) })}</code>
                        </span>
                      </span>
                    ),
                  },
                  {
                    id: "status",
                    header: t("webhook.deliveries.columns.status"),
                    cell: (d) => (
                      <span className="dev-two">
                        <span>
                          <OutcomeBadge outcome={outcomeOf(d, w)} />
                        </span>
                        <small>{words.line(d, w, now)}</small>
                      </span>
                    ),
                  },
                  {
                    id: "answer",
                    header: t("webhook.deliveries.columns.answer"),
                    width: 180,
                    cell: (d) => words.answer(d),
                  },
                  {
                    id: "attempts",
                    header: t("webhook.deliveries.columns.attempts"),
                    numeric: true,
                    width: 110,
                    cell: (d) => n(d.attempt),
                  },
                  {
                    id: "created",
                    header: t("webhook.deliveries.columns.made"),
                    numeric: true,
                    width: 140,
                    cell: (d) => <When at={d.created_at} now={now} />,
                  },
                ]}
                rowActions={(d) => (
                  <>
                    {canWrite && retriable(d) ? (
                      <MenuItem icon={RotateCwIcon} onClick={() => retry(d)}>
                        {outcomeOf(d, w) === "delivered"
                          ? t("delivery.sendAgain")
                          : t("delivery.retry")}
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      icon={CopyIcon}
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(d.id)
                          .then(() => toast.success(t("machine.actions.copied")))
                          .catch(() => toast.error(t("machine.actions.copyFailed")))
                      }
                    >
                      {t("delivery.copyId")}
                    </MenuItem>
                  </>
                )}
              />
            ) : null}
            {shown.length > PAGE ? (
              <Pagination
                offset={offset}
                pageSize={PAGE}
                itemsOnPage={Math.min(PAGE, shown.length - offset)}
                total={shown.length}
                onOffsetChange={setOffset}
              />
            ) : null}
            {deliveries.length || deliveriesQ.isLoading ? null : (
              <p className="dev-section-note">
                {off ? t("webhook.deliveries.noneOff") : t("webhook.deliveries.none")}
              </p>
            )}
          </DevSection>

          <EventsSection webhook={w} catalogue={catalogue} />
          <SecretSection
            webhook={w}
            now={now}
            onRotate={canWrite ? () => actions.rotate(w) : undefined}
          />
        </div>
      </PageContent>

      <DeliveryDrawer
        delivery={open}
        webhook={w}
        now={now}
        canRetry={canWrite && !!open && retriable(open)}
        retrying={retryM.isPending}
        onRetry={(d) =>
          retryM.mutate({ webhookId: w.id, deliveryId: d.id }, { onSuccess: () => setOpen(null) })
        }
        onClose={() => setOpen(null)}
      />
      {canWrite ? actions.secretDrawer : null}
    </>
  );
}

const isNotFound = (err: unknown) => err instanceof ApiError && err.status === 404;

/** What's true of the endpoint now, above its sections: turned off, failing, disabled, a rotation. */
