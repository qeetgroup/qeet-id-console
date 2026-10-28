import { PlusIcon } from "@qeetrix/icons";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Select,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import {
  type OidcClient,
  useCreateOidcClient,
  useUpdateOidcClient,
} from "@/modules/authentication/api/oidc-clients";
import { presentationUriField } from "@/modules/authentication/application-presentation-model";
import { fieldError } from "@/modules/authentication/components/connections/form-parts";
import { splitList } from "@/modules/authentication/oidc-apps-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";

const NAME_MAX_LENGTH = 200;
const DEFAULT_SCOPES = "openid profile email";

// The grants an application can hold (internal/federation/oidc: supportedClientGrantTypes). A
// public app can't exchange tokens or sign in on another device (CIBA): it has no secret.
const GRANTS = [
  ["authorization_code", "browser", false],
  ["refresh_token", "refresh", false],
  ["urn:ietf:params:oauth:grant-type:device_code", "device", false],
  ["urn:ietf:params:oauth:grant-type:token-exchange", "exchange", true],
  ["urn:openid:params:grant-type:ciba", "ciba", true],
] as const;

const lines = (value: string) =>
  value
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

export type OidcAppDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this application; without it, the drawer registers one. */
  client?: OidcClient;
};

/**
 * Register application, and Edit application: one drawer. A confidential application's secret is
 * in the server's answer once and stored hashed, so after registering one the drawer shows it, and
 * only Done closes it; then the app's page opens. Saving asks the person to confirm it's them.
 */
export function OidcAppDrawer({ open, onOpenChange, client }: OidcAppDrawerProps) {
  const { t } = useTranslation("oidc");
  const navigate = useNavigate();
  const [made, setMade] = useState<{ client: OidcClient; secret: string } | null>(null);
  const done = () => {
    const app = made?.client;
    setMade(null);
    onOpenChange(false);
    if (app)
      void navigate({
        to: "/auth/connections/oidc/$clientId",
        params: { clientId: app.client_id },
      });
  };
  return (
    <Drawer
      open={open}
      // The secret is shown once: only Done closes the drawer while it shows.
      onOpenChange={(next) => (made ? undefined : onOpenChange(next))}
    >
      <DrawerContent
        size="md"
        title={
          made
            ? t("drawer.madeTitle", { name: made.client.name })
            : client
              ? t("drawer.editTitle", { name: client.name })
              : t("drawer.title")
        }
        description={
          made
            ? t("drawer.madeDescription")
            : client
              ? t("drawer.editDescription")
              : t("drawer.description")
        }
      >
        {made ? (
          <>
            <DrawerBody>
              <OneTimeSecret
                title={t("drawer.secretTitle")}
                description={t("drawer.secretDescription")}
                values={[
                  { label: "client_id=", value: made.client.client_id },
                  { label: "client_secret=", value: made.secret },
                ]}
                dismissLabel={t("drawer.done")}
                onDismiss={done}
              />
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={done}>{t("drawer.done")}</Button>
            </DrawerFooter>
          </>
        ) : open ? (
          <OidcAppForm
            key={client?.id ?? "new"}
            client={client}
            onCancel={() => onOpenChange(false)}
            onSaved={(saved, secret) => {
              if (client) {
                onOpenChange(false);
                toast.success(t("drawer.saved", { name: saved.name }));
              } else if (secret) setMade({ client: saved, secret });
              else {
                onOpenChange(false);
                void navigate({
                  to: "/auth/connections/oidc/$clientId",
                  params: { clientId: saved.client_id },
                });
              }
            }}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function OidcAppForm({
  client,
  onCancel,
  onSaved,
}: {
  client?: OidcClient;
  onCancel: () => void;
  onSaved: (client: OidcClient, secret: string) => void;
}) {
  const { t } = useTranslation("oidc");
  const runSensitive = useSensitiveAction();
  const createM = useCreateOidcClient();
  const updateM = useUpdateOidcClient(client?.id ?? "");
  const [failure, setFailure] = useState<unknown>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("drawer.required.name")).max(NAME_MAX_LENGTH),
        type: z.enum(["public", "confidential"]),
        redirect_uris: z
          .string()
          .refine((v) => !!client || lines(v).length > 0, t("drawer.required.redirect"))
          .refine((v) => lines(v).every((u) => URL.canParse(u)), t("drawer.required.uri")),
        post_logout_uris: z
          .string()
          .refine((v) => lines(v).every((u) => URL.canParse(u)), t("drawer.required.uri")),
        // The server refuses an application holding it, on any change, since machine callers
        // became service principals; one registered before must drop it to be saved.
        grant_types: z
          .array(z.string())
          .refine((v) => !v.includes("client_credentials"), t("drawer.required.clientCredentials")),
        scopes: z.string(),
        logo_uri: presentationUriField,
        client_uri: presentationUriField,
      }),
    [t, client],
  );
  const form = useAppForm({
    defaultValues: {
      name: client?.name ?? "",
      type: (client?.type ?? "confidential") as "public" | "confidential",
      redirect_uris: (client?.redirect_uris ?? []).join("\n"),
      post_logout_uris: (client?.post_logout_uris ?? []).join("\n"),
      grant_types: client?.grant_types ?? ["authorization_code", "refresh_token"],
      scopes: client ? client.scopes.join(" ") : DEFAULT_SCOPES,
      logo_uri: client?.logo_uri ?? "",
      client_uri: client?.client_uri ?? "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      const body = {
        name: value.name.trim(),
        redirect_uris: lines(value.redirect_uris),
        post_logout_uris: lines(value.post_logout_uris),
        grant_types: value.grant_types,
        scopes: splitList(value.scopes.trim() || DEFAULT_SCOPES),
        logo_uri: value.logo_uri.trim(), // "" clears it
        client_uri: value.client_uri.trim(),
      };
      await runSensitive({
        capability: "connection.write",
        actionLabel: client ? t("drawer.saveAction") : t("drawer.registerAction"),
        run: async () =>
          client
            ? { client: await updateM.mutateAsync(body), client_secret: undefined }
            : createM.mutateAsync({ ...body, type: value.type }),
      })
        .then((res) => res && onSaved(res.client, res.client_secret ?? ""))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
          setFailure(err);
        });
    },
  });

  return (
    <form
      className="cx-drawer-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DrawerBody>
        <div className="sub-form">
          {failure ? (
            <Alert tone="danger" title={errorMessage(failure)}>
              <ErrorReference error={failure} />
            </Alert>
          ) : null}
          <form.Field name="name">
            {(field) => (
              <TextField
                label={t("drawer.name")}
                description={t("drawer.nameHint")}
                placeholder={t("drawer.namePlaceholder")}
                maxLength={NAME_MAX_LENGTH}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                autoComplete="off"
              />
            )}
          </form.Field>
          {client ? null : (
            <form.Field name="type">
              {(field) => (
                <Field
                  label={t("drawer.type")}
                  description={
                    field.state.value === "public"
                      ? t("drawer.typePublicHint")
                      : t("drawer.typeConfidentialHint")
                  }
                >
                  <Select<string>
                    value={field.state.value}
                    onValueChange={(v) => {
                      const type = v === "public" ? "public" : "confidential";
                      field.handleChange(type);
                      // A public app can't hold the grants that need a secret.
                      if (type === "public")
                        form.setFieldValue("grant_types", (grants) =>
                          grants.filter(
                            (g) => !GRANTS.some(([id, , secret]) => secret && id === g),
                          ),
                        );
                    }}
                    items={[
                      { value: "confidential", label: t("drawer.typeConfidential") },
                      { value: "public", label: t("drawer.typePublic") },
                    ]}
                  />
                </Field>
              )}
            </form.Field>
          )}
          <form.Field name="redirect_uris">
            {(field) => (
              <Field
                label={t("drawer.redirects")}
                description={t("drawer.redirectsHint")}
                error={fieldError(field)}
              >
                <Textarea
                  rows={2}
                  maxRows={6}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  placeholder={"https://app.example.com/callback\nhttp://localhost:3000/callback"}
                  spellCheck={false}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="post_logout_uris">
            {(field) => (
              <Field
                label={t("drawer.afterSignOut")}
                optional
                description={t("drawer.afterSignOutHint")}
                error={fieldError(field)}
              >
                <Textarea
                  rows={2}
                  maxRows={6}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v)}
                  onBlur={field.handleBlur}
                  placeholder="https://app.example.com/"
                  spellCheck={false}
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.values.type}>
            {(type) => (
              <form.Field name="grant_types">
                {(field) => (
                  <CheckboxGroup
                    label={t("drawer.grants")}
                    description={t("drawer.grantsHint")}
                    value={field.state.value}
                    onValueChange={(values) => field.handleChange(values as string[])}
                    error={fieldError(field)}
                  >
                    {GRANTS.map(([id, word, secret]) => (
                      <Checkbox
                        key={id}
                        value={id}
                        label={t(`grants.${word}`)}
                        description={t(`grants.${word}Hint`)}
                        disabled={secret && type === "public"}
                      />
                    ))}
                    {/* A grant it holds that isn't offered (one registered before), so it can be
                        dropped. */}
                    {(client?.grant_types ?? [])
                      .filter((g) => !GRANTS.some(([id]) => id === g))
                      .map((g) => (
                        <Checkbox key={g} value={g} label={g} />
                      ))}
                  </CheckboxGroup>
                )}
              </form.Field>
            )}
          </form.Subscribe>
          <form.Field name="scopes">
            {(field) => (
              <TextField
                label={t("drawer.scopes")}
                description={t("drawer.scopesHint")}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="logo_uri">
            {(field) => (
              <TextField
                type="url"
                label={t("presentation.logoUri")}
                optional
                description={t("presentation.logoUriHelp")}
                placeholder="https://app.example.com/logo.svg"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="client_uri">
            {(field) => (
              <TextField
                type="url"
                label={t("presentation.clientUri")}
                optional
                description={t("presentation.clientUriHelp")}
                placeholder="https://app.example.com/"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                {t("drawer.cancel")}
              </Button>
              <Button type="submit" icon={client ? undefined : PlusIcon} loading={busy}>
                {client ? t("drawer.save") : t("drawer.register")}
              </Button>
            </>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </form>
  );
}
