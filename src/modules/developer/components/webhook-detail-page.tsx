import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { formatLocale } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { ErrorText } from "@/platform/components/error-reference";
import { StatusPill } from "@/platform/components/status-pill";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  PlayIcon,
  PowerIcon,
  RotateCwIcon,
  TrashIcon,
  WebhookIcon,
} from "@qeetrix/icons";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import { OneTimeSecret } from "@/shared/components/one-time-secret";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type RotatedWebhookSecret,
  useDisableWebhook,
  useEnableWebhook,
  useRetryWebhookDelivery,
  useRotateWebhookSecret,
  useTestWebhook,
  useWebhook,
  useWebhookDeliveries,
} from "../api/webhooks";
import { WebhookStatusNote, WebhookStatusPill } from "./webhook-status";

/**
 * Renders one webhook: its state and configuration, delivery log, test send, retry, enable or
 * disable, and signing-secret rotation.
 */
export function WebhookDetailPage({ id }: { id: string }) {
  const { t } = useTranslation(["developer", "common"]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const runSensitive = useSensitiveAction();

  const webhookQ = useWebhook(id);
  const deliveriesQ = useWebhookDeliveries(id);
  const testWebhook = useTestWebhook();
  const retryDelivery = useRetryWebhookDelivery();
  const disableWebhook = useDisableWebhook();
  const enableWebhook = useEnableWebhook();
  const rotateSecret = useRotateWebhookSecret();
  const [rotated, setRotated] = useState<RotatedWebhookSecret | null>(null);

  const w = webhookQ.data;
  // The previous secret still signs, alongside the new one, until this passes.
  const overlapUntil =
    w?.previous_secret_expires_at && new Date(w.previous_secret_expires_at) > new Date()
      ? w.previous_secret_expires_at
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Link
        to="/developer/webhooks"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-3" /> {t("webhookDetail.back")}
      </Link>

      {rotated && (
        <OneTimeSecret
          title={t("webhookDetail.rotated.title")}
          description={t("webhookDetail.rotated.description", {
            until: new Date(rotated.previous_secret_expires_at).toLocaleString(formatLocale()),
          })}
          values={[{ value: rotated.secret }]}
          dismissLabel={t("common:actions.dismiss")}
          onDismiss={() => setRotated(null)}
        />
      )}

      <Card>
        <CardHeader>
          {webhookQ.isLoading ? (
            <>
              <Skeleton className="h-5 w-64" />
              <Skeleton className="mt-2 h-4 w-48" />
            </>
          ) : webhookQ.isError ? (
            <CardTitle className="text-base text-destructive">
              <ErrorText error={webhookQ.error} />
            </CardTitle>
          ) : w ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <WebhookIcon className="size-4 text-muted-foreground" />
                  <span className="break-all font-mono text-sm">{w.url}</span>
                </CardTitle>
                <CardDescription>
                  {t("webhookDetail.subscribedCount", {
                    count: w.events.length,
                  })}
                </CardDescription>
              </div>
              <WebhookStatusPill webhook={w} />
            </div>
          ) : null}
        </CardHeader>
        {w && (
          <CardContent className="flex flex-col gap-3">
            <WebhookStatusNote webhook={w} />
            {overlapUntil && (
              <p className="text-sm text-muted-foreground">
                {t("webhookDetail.overlap", {
                  until: new Date(overlapUntil).toLocaleString(formatLocale()),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {w.events.map((e) => (
                <Badge key={e} variant="muted" className="font-mono text-[10px]">
                  {e}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => testWebhook.mutate(id)}
                disabled={testWebhook.isPending || !!w.disabled_at}
              >
                <PlayIcon /> {t("webhookDetail.testEvent")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  runSensitive({
                    confirm: {
                      title: t("webhookDetail.confirm.rotateTitle"),
                      description: t("webhookDetail.confirm.rotateDescription"),
                      confirmLabel: t("webhookDetail.confirm.rotateLabel"),
                      tone: "default",
                    },
                    actionLabel: t("webhooks.stepUp.rotate"),
                    run: () => rotateSecret.mutateAsync(id),
                  })
                    .then((result) => result && setRotated(result))
                    .catch(settleSensitiveAction)
                }
                disabled={rotateSecret.isPending}
              >
                <KeyRoundIcon /> {t("webhookDetail.rotate")}
              </Button>
              {w.disabled_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    runSensitive({
                      actionLabel: t("webhooks.stepUp.enable"),
                      run: () => enableWebhook.mutateAsync(id),
                    }).catch(settleSensitiveAction)
                  }
                  disabled={enableWebhook.isPending}
                >
                  <PowerIcon /> {t("webhookDetail.enable")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    runSensitive({
                      confirm: {
                        title: t("webhookDetail.confirm.disableTitle"),
                        description: t("webhooks.confirm.disableDescription", {
                          url: w.url,
                        }),
                        confirmLabel: t("webhookDetail.confirm.disableLabel"),
                        tone: "destructive",
                      },
                      actionLabel: t("webhooks.stepUp.disable"),
                      run: () => disableWebhook.mutateAsync(id),
                    }).catch(settleSensitiveAction)
                  }
                  disabled={disableWebhook.isPending}
                >
                  <TrashIcon /> {t("webhookDetail.disable")}
                </Button>
              )}
              <span className="ms-auto text-xs text-muted-foreground">
                {t("webhookDetail.created")} <TimeSince value={w.created_at} />
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("webhookDetail.deliveries.title")}</CardTitle>
          <CardDescription>{t("webhookDetail.deliveries.description")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={deliveriesQ.isLoading}
            isError={deliveriesQ.isError}
            error={deliveriesQ.error}
            isEmpty={!deliveriesQ.data?.items?.length}
            emptyIcon={WebhookIcon}
            emptyTitle={t("webhookDetail.deliveries.empty")}
            emptyDescription={t("webhookDetail.deliveries.emptyDescription")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t("webhookDetail.deliveries.columns.when")}</TableHead>
                  <TableHead>{t("webhookDetail.deliveries.columns.event")}</TableHead>
                  <TableHead>{t("webhookDetail.deliveries.columns.status")}</TableHead>
                  <TableHead>{t("webhookDetail.deliveries.columns.attempts")}</TableHead>
                  <TableHead className="text-right">
                    {t("webhookDetail.deliveries.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveriesQ.data?.items?.map((d) => (
                  <Fragment key={d.id}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          aria-label={
                            expanded === d.id
                              ? t("webhookDetail.deliveries.collapse")
                              : t("webhookDetail.deliveries.expand")
                          }
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                        >
                          <ChevronDownIcon
                            className={`size-4 transition-transform ${expanded === d.id ? "rotate-180" : ""}`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <TimeSince value={d.created_at} className="font-mono text-xs" />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                      <TableCell>
                        <StatusPill
                          kind={
                            d.delivered_at
                              ? "success"
                              : d.dead_at
                                ? "danger"
                                : d.status_code && d.status_code >= 500
                                  ? "danger"
                                  : d.status_code
                                    ? "warning"
                                    : "muted"
                          }
                          dot
                        >
                          {d.delivered_at
                            ? t("webhookDetail.deliveries.statusDelivered")
                            : d.dead_at
                              ? t("webhookDetail.deliveries.statusDead")
                              : `${d.status_code ?? t("webhookDetail.deliveries.statusPending")}`}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.attempt}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => retryDelivery.mutate({ webhookId: id, deliveryId: d.id })}
                          disabled={retryDelivery.isPending}
                        >
                          <RotateCwIcon /> {t("webhookDetail.deliveries.retry")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded === d.id && (
                      <TableRow key={`${d.id}-detail`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="flex flex-col gap-3 py-2">
                            {d.error && <p className="text-destructive text-xs">{d.error}</p>}
                            <div>
                              <p className="mb-1 text-xs font-medium text-muted-foreground">
                                {t("webhookDetail.deliveries.requestPayload")}
                              </p>
                              <CodeBlock language="json" value={d.payload} />
                            </div>
                            {d.response_body && (
                              <div>
                                <p className="mb-1 text-xs font-medium text-muted-foreground">
                                  {t("webhookDetail.deliveries.responseBody")}
                                </p>
                                <CodeBlock language="text" value={d.response_body} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>

      {w && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("webhookDetail.sample.title")}</CardTitle>
            <CardDescription>{t("webhookDetail.sample.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              language="json"
              lineNumbers
              value={JSON.stringify(
                {
                  id: "8f14e45f-ceea-467f-a0e6-d2d1c4f3c2a1",
                  type: w.events[0] ?? "user.created",
                  tenant_id: w.tenant_id,
                  occurred_at: new Date().toISOString(),
                  data: {},
                },
                null,
                2,
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
