import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDate,
  Radio,
  RadioGroup,
  TextField,
} from "@qeetrix/react";
import { Alert, CodeBlock } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useTenantId } from "@/platform/auth/session";
import { getApiBaseUrl } from "@/platform/config/api-base-url";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateApiKey } from "@/modules/developer/api/api-key-actions";
import { DAY, type Machine } from "@/modules/developer/machine-model";
import { fieldError, FormFailure, ScopesField } from "../form-parts";
import { ShownOnceDrawer, useNumbers } from "../parts";

const EXPIRY = ["90", "365", "never"] as const;
type Expiry = (typeof EXPIRY)[number];

/**
 * New API key, and Replace key (a new key with the old one's scopes; the old one is revoked by hand
 * once nothing uses it, as the server has no rotate). The key is shown once, after it's made.
 */
export function KeyDrawer({
  open,
  onOpenChange,
  replacing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replacing?: Machine | null;
}) {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateApiKey();
  const [made, setMade] = useState<{
    name: string;
    secret: string;
    expires?: string;
    replaced?: string;
  } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const now = useMemo(() => (open ? Date.now() : 0), [open]);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("keyDrawer.nameRequired")),
        scopes: z.array(z.string()).min(1, t("keyDrawer.scopesRequired")),
        expiry: z.enum(EXPIRY),
      }),
    [t],
  );
  const defaults = useMemo(
    () => ({
      name: replacing ? t("keyDrawer.replacementName", { name: replacing.name }) : "",
      scopes: replacing?.scopes ?? ([] as string[]),
      expiry: "90" as Expiry,
    }),
    [replacing, t],
  );
  const form = useAppForm({
    defaultValues: defaults,
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      setFailure(null);
      const expiresAt =
        value.expiry === "never"
          ? undefined
          : new Date(Date.now() + Number(value.expiry) * DAY).toISOString();
      await runSensitive({
        actionLabel: t("keyDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({
            tenant_id: tenantId,
            name: value.name.trim(),
            scopes: value.scopes,
            expires_at: expiresAt,
          }),
      })
        .then((res) => {
          if (!res) return;
          setMade({
            name: res.api_key.name,
            secret: res.secret ?? "",
            expires: res.api_key.expires_at ?? undefined,
            replaced: replacing?.name,
          });
          onOpenChange(false);
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          setFailure(err);
          settleSensitiveAction(err);
        });
    },
  });

  // Each time it opens: a new key, or the replacement for `replacing`.
  useEffect(() => {
    if (!open) return;
    form.reset(defaults);
    setFailure(null);
  }, [open, defaults, form]);

  const until = (days: number) => formatDate(now + days * DAY, locale, { dateStyle: "medium" });

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
        }}
      >
        <DrawerContent
          title={
            replacing ? t("keyDrawer.replaceTitle", { name: replacing.name }) : t("keyDrawer.title")
          }
          description={replacing ? t("keyDrawer.replaceDescription") : t("keyDrawer.description")}
          size="md"
        >
          <DrawerBody>
            <form
              id="key-drawer"
              className="dev-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FormFailure error={failure} />
              <form.Field name="name">
                {(field) => (
                  <TextField
                    label={t("keyDrawer.name")}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("keyDrawer.namePlaceholder")}
                    autoComplete="off"
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="scopes">
                {(field) => (
                  <ScopesField
                    value={field.state.value}
                    onChange={field.handleChange}
                    description={t("keyDrawer.scopesHelp")}
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="expiry">
                {(field) => (
                  <RadioGroup
                    label={t("keyDrawer.expires")}
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as Expiry)}
                  >
                    <Radio
                      value="90"
                      label={
                        <span className="dev-choice">
                          {t("keyDrawer.in90")}
                          <Badge tone="brand" size="sm">
                            {t("keyDrawer.recommended")}
                          </Badge>
                        </span>
                      }
                      description={until(90)}
                    />
                    <Radio value="365" label={t("keyDrawer.in365")} description={until(365)} />
                    <Radio
                      value="never"
                      label={t("keyDrawer.never")}
                      description={t("keyDrawer.neverHelp")}
                    />
                  </RadioGroup>
                )}
              </form.Field>
            </form>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button type="submit" form="key-drawer" icon={ArrowRightIcon} loading={submitting}>
                  {t("keyDrawer.create")}
                </Button>
              )}
            </form.Subscribe>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ShownOnceDrawer
        open={!!made}
        title={made?.name ?? ""}
        description={
          made?.expires
            ? t("keyDrawer.madeExpires", {
                date: formatDate(made.expires, locale, { dateStyle: "long" }),
              })
            : t("keyDrawer.madeNever")
        }
        warning={made?.secret ? t("shownOnce.key") : t("keyDrawer.missingTitle")}
        why={made?.secret ? t("shownOnce.hashed") : t("keyDrawer.missing")}
        values={made?.secret ? [{ label: t("keyDrawer.keyLabel"), value: made.secret }] : []}
        onDone={() => setMade(null)}
      >
        {made?.secret ? (
          <CodeBlock
            language="shell"
            title={t("keyDrawer.useIt")}
            wrap
            code={`curl -H "Authorization: ApiKey $QEET_ID_API_KEY" \\\n  "${new URL(getApiBaseUrl()).origin}/v1/users"`}
          />
        ) : null}
        {made?.secret && made.replaced ? (
          <Alert tone="info" title={t("keyDrawer.thenRevoke", { name: made.replaced })}>
            {t("keyDrawer.thenRevokeHint")}
          </Alert>
        ) : null}
      </ShownOnceDrawer>
    </>
  );
}
