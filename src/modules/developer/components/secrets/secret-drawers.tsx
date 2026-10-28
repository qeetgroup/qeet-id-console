import { ArrowRightIcon, EyeOffIcon, RotateCwIcon } from "@qeetrix/icons";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  formatRelativeTime,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert, CopyButton, PasswordInput } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useMe } from "@/platform/auth/session";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type Secret, useCreateSecret, useRotateSecret } from "@/modules/developer/api/secrets";
import { fieldError, FormFailure } from "../form-parts";
import { useNumbers } from "../parts";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** New secret: its name (how it's read, `vault:<name>`, and fixed once saved), a label, the value. */
export function SecretDrawer({
  open,
  onOpenChange,
  taken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The names in use: a name is unique in the organisation. */
  taken: readonly string[];
}) {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const createM = useCreateSecret();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("secretDrawer.nameRequired"))
          .refine((v) => !taken.some((name) => same(name, v)), t("secretDrawer.nameTaken")),
        scope: z.string(),
        value: z.string().min(1, t("secretDrawer.valueRequired")),
      }),
    [t, taken],
  );
  const form = useAppForm({
    defaultValues: { name: "", scope: "", value: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      await runSensitive({
        actionLabel: t("secretDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({
            name: value.name.trim(),
            scope: value.scope.trim(),
            value: value.value,
          }),
      })
        .then((res) => res && onOpenChange(false))
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("secretDrawer.title")}
        description={t("secretDrawer.description")}
        size="md"
      >
        <DrawerBody>
          <form
            id="secret-drawer"
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
                  label={t("secretDrawer.name")}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder={t("secretDrawer.namePlaceholder")}
                  description={
                    field.state.value.trim()
                      ? t("secretDrawer.nameReadAs", { name: field.state.value.trim() })
                      : t("secretDrawer.nameHelp")
                  }
                  autoComplete="off"
                  error={fieldError(field.state.meta.errors)}
                />
              )}
            </form.Field>
            <form.Field name="scope">
              {(field) => (
                <TextField
                  label={t("secretDrawer.scope")}
                  optional
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  placeholder={t("secretDrawer.scopePlaceholder")}
                  description={t("secretDrawer.scopeHelp")}
                  autoComplete="off"
                />
              )}
            </form.Field>
            <form.Field name="value">
              {(field) => (
                <Field
                  label={t("secretDrawer.value")}
                  description={
                    fieldError(field.state.meta.errors) ? undefined : t("secretDrawer.valueHelp")
                  }
                  error={fieldError(field.state.meta.errors)}
                >
                  <PasswordInput
                    autoComplete="off"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  />
                </Field>
              )}
            </form.Field>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(submitting) => (
              <Button type="submit" form="secret-drawer" icon={ArrowRightIcon} loading={submitting}>
                {t("secretDrawer.save")}
              </Button>
            )}
          </form.Subscribe>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** Rotate: a new value replaces the old one at once (the server keeps no history). */
export function RotateDrawer({
  secret,
  now,
  onClose,
}: {
  secret: Secret | null;
  now: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const runSensitive = useSensitiveAction();
  const rotateM = useRotateSecret();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<unknown>(null);
  const open = !!secret;
  useEffect(() => {
    if (!open) return;
    setValue("");
    setError(undefined);
    setFailure(null);
  }, [open]);

  const submit = () => {
    if (!secret) return;
    if (!value) return setError(t("secretDrawer.valueRequired"));
    setFailure(null);
    void runSensitive({
      actionLabel: t("rotateSecret.stepUp"),
      run: () => rotateM.mutateAsync({ id: secret.id, value }),
    })
      .then((res) => res && onClose())
      .catch((err: unknown) => {
        setFailure(err);
        settleSensitiveAction(err);
      });
  };
  const changed = secret && secret.updated_at !== secret.created_at;

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent
        title={secret ? t("rotateSecret.title", { name: secret.name }) : ""}
        description={
          secret
            ? changed
              ? t("rotateSecret.lastChanged", {
                  when: formatRelativeTime(Date.parse(secret.updated_at), locale, now),
                })
              : t("rotateSecret.neverChanged")
            : undefined
        }
        size="md"
      >
        <DrawerBody>
          <form
            id="rotate-drawer"
            className="dev-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <FormFailure error={failure} />
            <Alert tone="warning" title={t("rotateSecret.warningTitle")}>
              {t("rotateSecret.warning", { name: secret?.name ?? "" })}
            </Alert>
            <Field
              label={t("rotateSecret.value")}
              description={error ? undefined : t("rotateSecret.valueHelp")}
              error={error}
            >
              <PasswordInput
                autoComplete="off"
                value={value}
                onValueChange={(v) => {
                  setValue(v);
                  setError(undefined);
                }}
              />
            </Field>
          </form>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
          <Button
            type="submit"
            form="rotate-drawer"
            icon={RotateCwIcon}
            loading={rotateM.isPending}
          >
            {t("rotateSecret.submit")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** A revealed value: the read is already in the audit log. Hide forgets it. */
export function RevealDialog({
  revealed,
  onClose,
}: {
  revealed: { secret: Secret; value: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("developer");
  const me = useMe().data;
  return (
    <Dialog open={!!revealed} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title={revealed?.secret.name ?? ""}
        description={t("secrets.reveal.recorded", {
          name: me?.display_name?.trim() || me?.email || "",
        })}
        size="md"
      >
        <DialogBody>
          <div className="dev-form">
            <Field label={t("secrets.reveal.value")}>
              <Textarea readOnly className="dev-code-area" rows={3} value={revealed?.value ?? ""} />
            </Field>
            <div>
              <CopyButton value={revealed?.value ?? ""} variant="soft">
                {t("secrets.reveal.copy")}
              </CopyButton>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button icon={EyeOffIcon} onClick={onClose}>
            {t("secrets.reveal.hide")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
