import { Button, Field, Input } from "@qeetrix/react";
import { CopyButton } from "@qeetrix/react/experimental";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import {
  type SocialProvider,
  socialRedirectUri,
  useDeleteSocialProvider,
  useUpsertSocialProvider,
} from "@/modules/authentication/api/social";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, Panel } from "./methods-parts";

/**
 * Adding a provider, or changing one's credentials, where its row was: the callback URL to give
 * the provider, then the client ID, secret and discovery URL it gives back. Saving a new one offers
 * it at sign-in straight away; saving an existing one keeps whether it's on, and an empty secret
 * keeps the stored one (qeet-id-server, social.UpsertProvider). An existing one can be removed here.
 */
export function SocialProviderPanel({
  id,
  label,
  discovery,
  existing,
  onClose,
}: {
  id: string;
  label: string;
  discovery: string;
  existing?: SocialProvider;
  onClose: () => void;
}) {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const upsert = useUpsertSocialProvider();
  const remove = useDeleteSocialProvider();
  const callback = socialRedirectUri(id);
  const schema = useMemo(
    () =>
      z.object({
        client_id: z.string().trim().min(1, t("social.form.clientIdRequired")),
        // An existing provider keeps its stored secret when the field is left empty.
        client_secret: existing
          ? z.string()
          : z.string().trim().min(1, t("social.form.secretRequired")),
        discovery_url: z.url({ protocol: /^https$/, error: t("social.form.discoveryInvalid") }),
      }),
    [existing, t],
  );
  const form = useAppForm({
    defaultValues: {
      client_id: existing?.client_id ?? "",
      client_secret: "",
      discovery_url: existing?.discovery_url ?? discovery,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: existing
          ? t("social.form.changeAction", { label })
          : t("social.form.addAction", { label }),
        run: () =>
          upsert.mutateAsync({
            provider: id,
            client_id: value.client_id.trim(),
            client_secret: value.client_secret.trim(),
            discovery_url: value.discovery_url.trim(),
          }),
      })
        .then((saved) => saved && onClose())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  const removeProvider = () =>
    runSensitive({
      confirm: {
        title: t("social.removeTitle", { label }),
        description: t("social.removeDescription", { label }),
        confirmLabel: t("methods.remove"),
        tone: "destructive",
      },
      actionLabel: t("social.removeAction", { label }),
      run: () => remove.mutateAsync(id),
    })
      .then(onClose)
      .catch(settleSensitiveAction);

  return (
    <Panel
      as="li"
      title={
        existing ? t("social.form.changeTitle", { label }) : t("social.form.addTitle", { label })
      }
      description={
        existing ? t("social.form.changeDescription") : t("social.form.addDescription", { label })
      }
    >
      <form
        className="account-panel-form am-panel-wide"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {/* A read-only value with Copy: the library's CopyField once it has one (findings §5). */}
        <Field
          label={t("social.form.callback")}
          description={t("social.form.callbackHint", { label })}
        >
          <Input
            readOnly
            value={callback}
            className="am-mono-input"
            endAdornment={
              <CopyButton value={callback} label={t("social.form.copyCallback")} size="sm" />
            }
          />
        </Field>
        <form.AppField name="client_id">
          {(field) => (
            <field.TextField
              label={t("social.form.clientId")}
              placeholder={existing ? undefined : t("social.form.clientIdPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </form.AppField>
        <form.AppField name="client_secret">
          {(field) => (
            <field.PasswordField
              label={t("social.form.secret")}
              description={existing ? t("social.form.secretKeep") : t("social.form.secretHint")}
              autoComplete="new-password"
            />
          )}
        </form.AppField>
        <form.AppField name="discovery_url">
          {(field) => (
            <field.TextField
              label={t("social.form.discovery")}
              description={
                discovery && !existing
                  ? t("social.form.discoveryFilled", { label })
                  : t("social.form.discoveryHint")
              }
              placeholder={discovery ? undefined : t("social.form.discoveryPlaceholder")}
              type="url"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </form.AppField>
        <Failure error={upsert.error ?? remove.error} />
        <span className="account-panel-actions">
          <Button size="lg" type="submit" loading={upsert.isPending}>
            {existing ? t("social.form.save") : t("social.form.add", { label })}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            {t("methods.cancel")}
          </Button>
          {existing && (
            <Button
              variant="ghost"
              tone="danger"
              size="lg"
              className="am-push"
              loading={remove.isPending}
              onClick={() => void removeProvider()}
            >
              {t("social.remove", { label })}
            </Button>
          )}
        </span>
      </form>
    </Panel>
  );
}
