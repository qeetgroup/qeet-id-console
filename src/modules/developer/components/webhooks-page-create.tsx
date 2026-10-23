import {
  Button,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { WebhookIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useTenantId } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useCreateWebhook,
  useWebhookEvents,
  type Webhook,
  type WebhookEventType,
} from "../api/webhooks";
import { webhookEventDescription } from "../webhook-state";

/** Renders the sheet that subscribes an endpoint to events; the parent shows its secret once. */
export function CreateWebhookSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (webhook: Webhook) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && (
          <CreateWebhookForm
            onCreated={(webhook) => {
              onCreated(webhook);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateWebhookForm({ onCreated }: { onCreated: (webhook: Webhook) => void }) {
  const { t } = useTranslation("developer");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateWebhook();
  const eventsQ = useWebhookEvents();
  const schema = useMemo(
    () =>
      z.object({
        url: z.url({ protocol: /^https?$/, error: t("webhooks.create.validation.url") }),
        events: z.array(z.string()).min(1, t("webhooks.create.validation.events")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { url: "", events: [] as string[] },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      await runSensitive({
        actionLabel: t("webhooks.stepUp.create"),
        run: () =>
          createM.mutateAsync({ tenant_id: tenantId, url: value.url.trim(), events: value.events }),
      })
        .then((webhook) => webhook && onCreated(webhook))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t("webhooks.create.title")}</SheetTitle>
        <SheetDescription>{t("webhooks.create.description")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="url">
            {(field) => (
              <field.TextField
                label={t("webhooks.create.url")}
                description={t("webhooks.create.urlHelp")}
                type="url"
                placeholder={t("webhooks.create.urlPlaceholder")}
                required
              />
            )}
          </form.AppField>
          <form.AppField name="events">
            {(field) => (
              <FieldFrame
                label={t("webhooks.create.events")}
                description={t("webhooks.create.eventsCount", { count: field.state.value.length })}
              >
                <DataState
                  isLoading={eventsQ.isLoading}
                  isError={eventsQ.isError}
                  error={eventsQ.error}
                  isEmpty={!eventsQ.data?.items.length}
                  emptyIcon={WebhookIcon}
                  emptyTitle={t("webhooks.create.noEvents")}
                  skeletonRows={4}
                >
                  <EventChoices events={eventsQ.data?.items ?? []} selected={field.state.value} />
                </DataState>
              </FieldFrame>
            )}
          </form.AppField>
          <FormError error={createM.error} />
        </FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("webhooks.create.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("webhooks.create.submitting")}>
            {t("webhooks.create.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}

// The catalogue's events as checkboxes, bound to the enclosing form field as one list.
function EventChoices({ events, selected }: { events: WebhookEventType[]; selected: string[] }) {
  const change = useFieldChange<string[]>();
  const toggle = (name: string) =>
    change(selected.includes(name) ? selected.filter((e) => e !== name) : [...selected, name]);
  return (
    <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3">
      {events.map((ev) => {
        const description = webhookEventDescription(ev.name);
        return (
          <label key={ev.name} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(ev.name)}
              onChange={() => toggle(ev.name)}
            />
            <span className="flex min-w-0 flex-col">
              <code className="text-xs">{ev.name}</code>
              {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
