import { CodeBlock } from "@qeetrix/react/experimental";
import { formatDateTime } from "@qeetrix/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useDisableWebhook,
  useEnableWebhook,
  useRotateWebhookSecret,
  useTestWebhook,
} from "@/modules/developer/api/webhook-actions";
import type { Webhook } from "@/modules/developer/api/webhooks";
import { endpointParts } from "@/modules/developer/webhook-state";
import { ShownOnceDrawer, useNumbers } from "../parts";

/**
 * What a webhook's menu does, for the list and its page alike: send a test event, rotate the
 * signing secret (the new one shown once), disable and enable. Each confirm says what happens to
 * the deliveries, from the server's rules. Render `secretDrawer` once on the page.
 */
export function useWebhookActions() {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const runSensitive = useSensitiveAction();
  const disableM = useDisableWebhook();
  const enableM = useEnableWebhook();
  const rotateM = useRotateWebhookSecret();
  const testM = useTestWebhook();
  const [rotated, setRotated] = useState<{ host: string; secret: string; until: string } | null>(
    null,
  );
  const settle = (p: Promise<unknown>) => void p.catch(settleSensitiveAction);
  const host = (w: Webhook) => endpointParts(w.url).host;

  return {
    pending: disableM.isPending || enableM.isPending || rotateM.isPending || testM.isPending,
    test: (w: Webhook) => testM.mutate(w.id),
    disable: (w: Webhook) =>
      settle(
        runSensitive({
          confirm: {
            title: t("webhooks.confirm.disableTitle", { host: host(w) }),
            description: t("webhooks.confirm.disable"),
            confirmLabel: t("webhooks.confirm.disableLabel"),
            tone: "destructive",
          },
          capability: "webhook.write",
          actionLabel: t("webhooks.confirm.disableAction"),
          run: () => disableM.mutateAsync(w.id),
        }),
      ),
    enable: (w: Webhook) =>
      settle(
        runSensitive({
          capability: "webhook.write",
          actionLabel: t("webhooks.confirm.enableAction", { host: host(w) }),
          run: () => enableM.mutateAsync(w.id),
        }),
      ),
    rotate: (w: Webhook) =>
      settle(
        runSensitive({
          confirm: {
            title: t("webhooks.confirm.rotateTitle", { host: host(w) }),
            description: t("webhooks.confirm.rotate"),
            confirmLabel: t("webhooks.confirm.rotateLabel"),
            tone: "default",
          },
          capability: "webhook.write",
          actionLabel: t("webhooks.confirm.rotateAction"),
          run: () => rotateM.mutateAsync(w.id),
        }).then((res) => {
          if (res)
            setRotated({
              host: host(w),
              secret: res.secret,
              until: res.previous_secret_expires_at,
            });
        }),
      ),
    secretDrawer: (
      <ShownOnceDrawer
        open={!!rotated}
        title={rotated ? t("webhooks.rotated.title", { host: rotated.host }) : ""}
        description={
          rotated
            ? t("webhooks.rotated.description", {
                date: formatDateTime(rotated.until, locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })
            : undefined
        }
        warning={t("shownOnce.signingSecret")}
        why={t("shownOnce.signingSecretWhy")}
        values={rotated ? [{ label: t("webhooks.signingSecret"), value: rotated.secret }] : []}
        onDone={() => setRotated(null)}
      >
        <VerifySample />
      </ShownOnceDrawer>
    ),
  };
}

/** How an endpoint checks a delivery: the signature over the timestamp, a dot and the body. */
export function VerifySample() {
  const { t } = useTranslation("developer");
  return (
    <CodeBlock
      language="javascript"
      title={t("webhooks.verifySample")}
      wrap
      code={[
        'import { createHmac, timingSafeEqual } from "node:crypto";',
        "",
        "// body: the raw request body; headers: the request's headers.",
        'const signed = headers["x-qeet-timestamp"] + "." + body;',
        'const expected = "sha256=" + createHmac("sha256", process.env.QEET_WEBHOOK_SECRET).update(signed).digest("hex");',
        "// While a previous secret still signs, the header holds two, comma-separated.",
        'const ok = headers["x-qeet-signature"].split(",").some((s) =>',
        "  s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));",
      ].join("\n")}
    />
  );
}
