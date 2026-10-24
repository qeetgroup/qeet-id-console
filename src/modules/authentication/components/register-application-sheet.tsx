import {
  Button,
  Callout,
  FieldGroup,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { InfoIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

import { type OidcClient, useCreateOidcClient } from "../api/oidc-clients";
import { presentationUriField } from "../application-presentation-model";

const NAME_MAX_LENGTH = 200;
const DEFAULT_SCOPES = "openid profile email";

type RegisterApplicationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the created client plus its one-time secret ("" for public clients). */
  onCreated: (client: OidcClient, secret: string) => void;
};

/** Splits a textarea into trimmed, non-empty lines. */
function lines(value: string): string[] {
  return value
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUrl(value: string): boolean {
  return URL.canParse(value);
}

/**
 * Renders the "Register OAuth / OIDC application" slide-over. There is no description field: the
 * server has nowhere to store one.
 */
export function RegisterApplicationSheet({
  open,
  onOpenChange,
  onCreated,
}: RegisterApplicationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {open && (
          <RegisterApplicationForm
            onCreated={(client, secret) => {
              onCreated(client, secret);
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RegisterApplicationForm({
  onCreated,
}: {
  onCreated: (client: OidcClient, secret: string) => void;
}) {
  const { t } = useTranslation(["oidc", "common"]);
  const runSensitive = useSensitiveAction();
  const createM = useCreateOidcClient();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("create.validation.name")).max(NAME_MAX_LENGTH),
        type: z.enum(["public", "confidential"]),
        redirect_uris: z
          .string()
          .refine((v) => lines(v).length > 0, t("create.validation.redirectUris"))
          .refine((v) => lines(v).every(isUrl), t("create.validation.uri")),
        post_logout_uris: z
          .string()
          .refine((v) => lines(v).every(isUrl), t("create.validation.uri")),
        scopes: z.string(),
        logo_uri: presentationUriField,
        client_uri: presentationUriField,
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: "",
      type: "public" as "public" | "confidential",
      redirect_uris: "",
      post_logout_uris: "",
      scopes: DEFAULT_SCOPES,
      logo_uri: "",
      client_uri: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const body = {
        name: value.name.trim(),
        type: value.type,
        redirect_uris: lines(value.redirect_uris),
        post_logout_uris: lines(value.post_logout_uris),
        grant_types: ["authorization_code", "refresh_token"],
        scopes: (value.scopes.trim() || DEFAULT_SCOPES).split(/\s+/),
        logo_uri: value.logo_uri.trim(),
        client_uri: value.client_uri.trim(),
      };
      await runSensitive({ actionLabel: t("create.stepUp"), run: () => createM.mutateAsync(body) })
        .then((res) => res && onCreated(res.client, res.client_secret ?? ""))
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
        <SheetTitle>{t("create.title")}</SheetTitle>
        <SheetDescription>{t("create.description")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("create.name")}
                description={t("create.nameHelp")}
                placeholder={t("create.namePlaceholder")}
                maxLength={NAME_MAX_LENGTH}
                required
              />
            )}
          </form.AppField>

          <form.Subscribe selector={(state) => state.values.type}>
            {(type) => (
              <>
                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t("create.type")}
                      description={
                        type === "public"
                          ? t("create.typePublicHelp")
                          : t("create.typeConfidentialHelp")
                      }
                      options={[
                        { value: "public", label: t("create.typePublic") },
                        { value: "confidential", label: t("create.typeConfidential") },
                      ]}
                    />
                  )}
                </form.AppField>
                <Callout
                  variant="info"
                  icon={<InfoIcon />}
                  title={
                    type === "public"
                      ? t("create.publicCalloutTitle")
                      : t("create.confidentialCalloutTitle")
                  }
                >
                  {type === "public"
                    ? t("create.publicCalloutBody")
                    : t("create.confidentialCalloutBody")}
                </Callout>
              </>
            )}
          </form.Subscribe>

          <form.AppField name="redirect_uris">
            {(field) => (
              <field.TextareaField
                label={t("create.redirectUris")}
                description={t("create.redirectUrisHelp")}
                placeholder={"http://localhost:3000/callback\nhttps://app.acme.com/callback"}
                rows={3}
                required
              />
            )}
          </form.AppField>

          <form.AppField name="post_logout_uris">
            {(field) => (
              <field.TextareaField
                label={t("create.postLogoutUris")}
                description={t("create.postLogoutUrisHelp")}
                placeholder="https://app.acme.com/"
                rows={2}
              />
            )}
          </form.AppField>

          <form.AppField name="scopes">
            {(field) => (
              <field.TextField label={t("create.scopes")} description={t("create.scopesHelp")} />
            )}
          </form.AppField>

          <form.AppField name="logo_uri">
            {(field) => (
              <field.TextField
                type="url"
                label={t("presentation.logoUri")}
                description={t("presentation.logoUriHelp")}
                placeholder="https://app.acme.com/logo.svg"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </form.AppField>

          <form.AppField name="client_uri">
            {(field) => (
              <field.TextField
                type="url"
                label={t("presentation.clientUri")}
                description={t("presentation.clientUriHelp")}
                placeholder="https://app.acme.com/"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </form.AppField>

          <FormError error={createM.error} />
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <SheetClose render={<Button type="button" variant="outline" />}>
          {t("common:actions.cancel")}
        </SheetClose>
        <form.AppForm>
          <form.SubmitButton pendingLabel={t("create.submitting")}>
            {t("create.submit")}
          </form.SubmitButton>
        </form.AppForm>
      </SheetFooter>
    </form>
  );
}
