import { PlusIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Select,
  TextField,
} from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import {
  type SamlProvider,
  useCreateSamlProvider,
  useUpdateSamlProvider,
} from "@/modules/authentication/api/saml-idp";
import { fieldError } from "@/modules/authentication/components/connections/form-parts";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

// The Name ID formats an app may ask for. The value is the person's email address whichever it
// is (internal/federation/saml/idp.go); the format only labels it.
export const NAME_ID_FORMATS = [
  ["urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", "email"],
  ["urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified", "unspecified"],
  ["urn:oasis:names:tc:SAML:2.0:nameid-format:persistent", "persistent"],
] as const;
export type NameIdFormat = (typeof NAME_ID_FORMATS)[number][1];
export const nameIdFormat = (urn: string): NameIdFormat | undefined =>
  NAME_ID_FORMATS.find(([value]) => value === urn)?.[1];

// The server's rule for where an assertion may be posted: https, or http to this computer.
function validAcs(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (!u.hostname || u.username) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export type SamlAppDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this app; without it, the drawer adds one. */
  app?: SamlProvider;
};

/**
 * Add app, and Edit app: what the app gave you (its entity ID and where it takes the sign-in
 * response) and the Name ID format it asks for. Saving asks the person to confirm it's them.
 */
export function SamlAppDrawer({ open, onOpenChange, app }: SamlAppDrawerProps) {
  const { t } = useTranslation("saml");
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="md"
        title={app ? t("appDrawer.editTitle", { name: app.name }) : t("appDrawer.title")}
        description={app ? t("appDrawer.editDescription") : t("appDrawer.description")}
      >
        {open ? (
          <SamlAppForm key={app?.id ?? "new"} app={app} onDone={() => onOpenChange(false)} />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function SamlAppForm({ app, onDone }: { app?: SamlProvider; onDone: () => void }) {
  const { t } = useTranslation("saml");
  const runSensitive = useSensitiveAction();
  const createM = useCreateSamlProvider();
  const updateM = useUpdateSamlProvider({ inline: true });
  const [failure, setFailure] = useState<unknown>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("appDrawer.required.name")),
        entity_id: z.string().trim().min(1, t("appDrawer.required.entityId")),
        acs_url: z.string().trim().refine(validAcs, t("appDrawer.required.acsUrl")),
        name_id_format: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: app?.name ?? "",
      entity_id: app?.entity_id ?? "",
      acs_url: app?.acs_url ?? "",
      name_id_format: app?.name_id_format || NAME_ID_FORMATS[0][0],
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      const body = {
        name: value.name.trim(),
        entity_id: value.entity_id.trim(),
        acs_url: value.acs_url.trim(),
        name_id_format: value.name_id_format,
      };
      await runSensitive({
        capability: "connection.write",
        actionLabel: app ? t("appDrawer.saveAction") : t("appDrawer.addAction"),
        run: () => (app ? updateM.mutateAsync({ id: app.id, ...body }) : createM.mutateAsync(body)),
      })
        .then((saved) => {
          if (!saved) return;
          onDone();
          if (app) toast.success(t("appDrawer.saved", { name: saved.name }));
        })
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
                label={t("appDrawer.name")}
                description={t("appDrawer.nameHint")}
                placeholder="Slack"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="entity_id">
            {(field) => (
              <TextField
                label={t("appDrawer.entityId")}
                description={t("appDrawer.entityIdHint")}
                placeholder="https://slack.com"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="acs_url">
            {(field) => (
              <TextField
                label={t("appDrawer.acsUrl")}
                description={t("appDrawer.acsUrlHint")}
                placeholder="https://acme.slack.com/sso/saml"
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v)}
                onBlur={field.handleBlur}
                error={fieldError(field)}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form.Field>
          <form.Field name="name_id_format">
            {(field) => (
              <Field
                label={t("appDrawer.nameIdFormat")}
                description={t("appDrawer.nameIdFormatHint")}
              >
                <Select<string>
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(String(v ?? NAME_ID_FORMATS[0][0]))}
                  items={[
                    ...NAME_ID_FORMATS.map(([value, id]) => ({
                      value,
                      label:
                        id === "email"
                          ? t("appDrawer.recommended", { format: t("appDrawer.formats.email") })
                          : t(`appDrawer.formats.${id}`),
                    })),
                    // A format set elsewhere stays choosable as itself.
                    ...(nameIdFormat(field.state.value)
                      ? []
                      : [{ value: field.state.value, label: field.state.value }]),
                  ]}
                />
              </Field>
            )}
          </form.Field>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(busy) => (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
                {t("drawer.cancel")}
              </Button>
              <Button type="submit" icon={app ? undefined : PlusIcon} loading={busy}>
                {app ? t("appDrawer.save") : t("appDrawer.add")}
              </Button>
            </>
          )}
        </form.Subscribe>
      </DrawerFooter>
    </form>
  );
}
