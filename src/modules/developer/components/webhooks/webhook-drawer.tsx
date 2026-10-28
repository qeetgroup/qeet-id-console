import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Skeleton,
  Text,
  TextField,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useTenantId } from "@/platform/auth/session";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateWebhook } from "@/modules/developer/api/webhook-actions";
import { useWebhookEvents } from "@/modules/developer/api/webhooks";
import {
  areaOf,
  EVENT_AREAS,
  endpointParts,
  webhookEventDescription,
} from "@/modules/developer/webhook-state";
import { fieldError, FormFailure } from "../form-parts";
import { ShownOnceDrawer, useNumbers } from "../parts";
import { VerifySample } from "./use-webhook-actions";

/**
 * New webhook: the endpoint and the events it gets, by area. Neither can change afterwards (the
 * server has no edit), so the drawer says so. The signing secret is shown once, after it's made.
 */
export function WebhookDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateWebhook();
  const eventsQ = useWebhookEvents();
  const [made, setMade] = useState<{ host: string; secret: string } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const catalogue = (eventsQ.data?.items ?? []).filter((e) => e.name !== "test.ping");
  const groups = EVENT_AREAS.map((area) => ({
    area,
    events: catalogue.filter((e) => areaOf(e.name) === area),
  })).filter((g) => g.events.length);
  const schema = useMemo(
    () =>
      z.object({
        url: z.url({ protocol: /^https?$/, error: t("webhookDrawer.urlInvalid") }),
        events: z.array(z.string()).min(1, t("webhookDrawer.eventsRequired")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { url: "", events: [] as string[] },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      setFailure(null);
      await runSensitive({
        actionLabel: t("webhookDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({ tenant_id: tenantId, url: value.url.trim(), events: value.events }),
      })
        .then((res) => {
          if (!res) return;
          setMade({ host: endpointParts(res.url).host, secret: res.secret ?? "" });
          onOpenChange(false);
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          setFailure(err);
          settleSensitiveAction(err);
        });
    },
  });
  useEffect(() => {
    if (!open) return;
    form.reset();
    setFailure(null);
  }, [open, form]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          title={t("webhookDrawer.title")}
          description={t("webhookDrawer.description")}
          size="md"
        >
          <DrawerBody>
            <form
              id="webhook-drawer"
              className="dev-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FormFailure error={failure} />
              <form.Field name="url">
                {(field) => (
                  <TextField
                    label={t("webhookDrawer.url")}
                    type="url"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("webhookDrawer.urlPlaceholder")}
                    description={t("webhookDrawer.urlHelp")}
                    autoComplete="off"
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="events">
                {(field) => (
                  <div className="dev-events-field">
                    <div className="dev-events-head">
                      <Text weight="semibold">{t("webhookDrawer.events")}</Text>
                      <Text tone="subtle" size="sm">
                        {t("webhookDrawer.chosen", {
                          n: n(field.state.value.length),
                          total: n(catalogue.length),
                        })}
                      </Text>
                    </div>
                    {fieldError(field.state.meta.errors) ? (
                      <Alert tone="danger" title={fieldError(field.state.meta.errors)} />
                    ) : null}
                    {eventsQ.isLoading ? <Skeleton lines={6} /> : null}
                    {groups.map((g) => (
                      <CheckboxGroup
                        key={g.area}
                        label={t(`webhooks.area.${g.area}`)}
                        value={field.state.value.filter((e) => areaOf(e) === g.area)}
                        onValueChange={(chosen) =>
                          field.handleChange([
                            ...field.state.value.filter((e) => areaOf(e) !== g.area),
                            ...(chosen as string[]),
                          ])
                        }
                      >
                        {g.events.map((e) => (
                          <Checkbox
                            key={e.name}
                            value={e.name}
                            label={<code className="dev-code">{e.name}</code>}
                            description={webhookEventDescription(e.name)}
                          />
                        ))}
                      </CheckboxGroup>
                    ))}
                  </div>
                )}
              </form.Field>
            </form>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button
                  type="submit"
                  form="webhook-drawer"
                  icon={ArrowRightIcon}
                  loading={submitting}
                >
                  {t("webhookDrawer.create")}
                </Button>
              )}
            </form.Subscribe>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ShownOnceDrawer
        open={!!made}
        title={made?.host ?? ""}
        description={t("webhookDrawer.made")}
        warning={t("shownOnce.signingSecret")}
        why={t("shownOnce.signingSecretWhy")}
        values={made?.secret ? [{ label: t("webhooks.signingSecret"), value: made.secret }] : []}
        onDone={() => setMade(null)}
      >
        <VerifySample />
      </ShownOnceDrawer>
    </>
  );
}
