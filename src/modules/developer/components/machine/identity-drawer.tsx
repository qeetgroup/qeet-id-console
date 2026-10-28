import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  TextField,
} from "@qeetrix/react";
import { CodeBlock } from "@qeetrix/react/experimental";
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
import { useCreateServicePrincipal } from "@/modules/developer/api/service-principal-actions";
import { fieldError, FormFailure, ScopesField } from "../form-parts";
import { ShownOnceDrawer } from "../parts";

/**
 * New machine identity: a name and scopes. (The server stores a description it never returns, so
 * the drawer doesn't ask for one.) Its client ID and secret are shown once, after it's made.
 */
export function IdentityDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("developer");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const createM = useCreateServicePrincipal();
  const [made, setMade] = useState<{ name: string; clientId: string; secret: string } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("identityDrawer.nameRequired")),
        scopes: z.array(z.string()).min(1, t("identityDrawer.scopesRequired")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", scopes: [] as string[] },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      setFailure(null);
      await runSensitive({
        actionLabel: t("identityDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({
            tenant_id: tenantId,
            name: value.name.trim(),
            scopes: value.scopes,
          }),
      })
        .then((res) => {
          if (!res) return;
          setMade({
            name: res.service_principal.name,
            clientId: res.client_id,
            secret: res.client_secret,
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

  useEffect(() => {
    if (!open) return;
    form.reset();
    setFailure(null);
  }, [open, form]);

  const origin = new URL(getApiBaseUrl()).origin;
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          title={t("identityDrawer.title")}
          description={t("identityDrawer.description")}
          size="md"
        >
          <DrawerBody>
            <form
              id="identity-drawer"
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
                    label={t("identityDrawer.name")}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("identityDrawer.namePlaceholder")}
                    description={t("identityDrawer.nameHelp")}
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
                    description={t("identityDrawer.scopesHelp")}
                    error={fieldError(field.state.meta.errors)}
                  />
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
                  form="identity-drawer"
                  icon={ArrowRightIcon}
                  loading={submitting}
                >
                  {t("identityDrawer.create")}
                </Button>
              )}
            </form.Subscribe>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ShownOnceDrawer
        open={!!made}
        title={made?.name ?? ""}
        description={t("identityDrawer.made")}
        warning={t("shownOnce.clientSecret")}
        why={t("shownOnce.hashed")}
        values={
          made
            ? [
                { label: t("identityDrawer.clientId"), value: made.clientId },
                { label: t("identityDrawer.clientSecret"), value: made.secret },
              ]
            : []
        }
        onDone={() => setMade(null)}
      >
        {made ? (
          <CodeBlock
            language="shell"
            title={t("identityDrawer.getToken")}
            wrap
            code={`curl -X POST "${origin}/v1/oauth/token" \\\n  -d grant_type=client_credentials \\\n  -d client_id=${made.clientId} \\\n  -d client_secret="$QEET_ID_CLIENT_SECRET"`}
          />
        ) : null}
      </ShownOnceDrawer>
    </>
  );
}
