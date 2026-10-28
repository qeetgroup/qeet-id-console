import { RotateCwIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  formatRelativeTime,
  Text,
} from "@qeetrix/react";
import { Alert, CodeBlock, DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import type { Webhook, WebhookDelivery } from "@/modules/developer/api/webhooks";
import { MAX_ATTEMPTS, outcomeOf } from "@/modules/developer/webhook-state";
import { useNumbers } from "../parts";
import { OutcomeBadge, useDeliveryWords } from "./delivery-parts";

const pretty = (raw: string) => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

/**
 * One delivery: where it stands, its attempts, the endpoint's last answer, the request it sent and
 * the response it got. Retry re-queues it (any delivery, delivered ones too); the attempt count
 * carries on, so one that already used its 60 attempts gives up at its next failure.
 */
export function DeliveryDrawer({
  delivery: d,
  webhook: w,
  now,
  canRetry,
  retrying,
  onRetry,
  onClose,
}: {
  delivery: WebhookDelivery | null;
  webhook: Webhook;
  now: number;
  canRetry: boolean;
  retrying: boolean;
  onRetry: (d: WebhookDelivery) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const words = useDeliveryWords();
  const full = (iso: string) =>
    formatDateTime(iso, locale, { dateStyle: "long", timeStyle: "medium" });
  const outcome = d ? outcomeOf(d, w) : "queued";

  return (
    <Drawer open={!!d} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        title={d ? <code className="dev-code-title">{d.event_type}</code> : ""}
        description={
          d
            ? t("delivery.drawerDescription", {
                id: d.id,
                when: formatRelativeTime(Date.parse(d.created_at), locale, now),
              })
            : undefined
        }
        size="lg"
      >
        {d ? (
          <DrawerBody>
            <div className="dev-form">
              {d.attempt >= MAX_ATTEMPTS && outcome === "gaveUp" ? (
                <Alert tone="info" title={t("delivery.usedUp")}>
                  {t("delivery.usedUpNote", { max: MAX_ATTEMPTS })}
                </Alert>
              ) : null}
              <DescriptionList>
                <DescriptionItem term={t("delivery.facts.status")}>
                  <span className="dev-inline">
                    <OutcomeBadge outcome={outcome} />
                    <Text tone="subtle" size="sm">
                      {words.line(d, w, now)}
                    </Text>
                  </span>
                </DescriptionItem>
                <DescriptionItem term={t("delivery.facts.attempts")}>
                  {t("delivery.facts.attemptsOf", { n: d.attempt, max: MAX_ATTEMPTS })}
                </DescriptionItem>
                <DescriptionItem term={t("delivery.facts.answer")}>
                  {words.answer(d)}
                </DescriptionItem>
                {d.error ? (
                  <DescriptionItem term={t("delivery.facts.error")}>
                    <code className="dev-code dev-wrap">{d.error}</code>
                  </DescriptionItem>
                ) : null}
                <DescriptionItem term={t("delivery.facts.made")}>
                  {full(d.created_at)}
                </DescriptionItem>
                {d.delivered_at ? (
                  <DescriptionItem term={t("delivery.facts.delivered")}>
                    {full(d.delivered_at)}
                  </DescriptionItem>
                ) : null}
                {d.dead_at ? (
                  <DescriptionItem term={t("delivery.facts.gaveUp")}>
                    {full(d.dead_at)}
                  </DescriptionItem>
                ) : null}
                {outcome === "retrying" && d.next_attempt_at ? (
                  <DescriptionItem term={t("delivery.facts.next")}>
                    {full(d.next_attempt_at)}
                  </DescriptionItem>
                ) : null}
                <DescriptionItem term={t("delivery.facts.id")}>
                  <code className="dev-code">{d.id}</code>
                </DescriptionItem>
              </DescriptionList>
              <CodeBlock language="json" title={t("delivery.request")} code={pretty(d.payload)} />
              {d.response_body ? (
                <CodeBlock
                  language="text"
                  title={t("delivery.response")}
                  code={pretty(d.response_body)}
                  wrap
                />
              ) : (
                <Text tone="subtle" size="sm">
                  {d.status_code ? t("delivery.noBody") : t("delivery.notReached")}
                </Text>
              )}
            </div>
          </DrawerBody>
        ) : null}
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("delivery.close")}</Button>} />
          {d && canRetry ? (
            <Button
              variant={outcome === "delivered" ? "soft" : undefined}
              icon={RotateCwIcon}
              loading={retrying}
              onClick={() => onRetry(d)}
            >
              {outcome === "delivered" ? t("delivery.sendAgain") : t("delivery.retry")}
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
