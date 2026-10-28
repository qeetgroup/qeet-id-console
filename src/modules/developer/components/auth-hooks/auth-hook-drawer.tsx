import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  Radio,
  RadioGroup,
  TextField,
} from "@qeetrix/react";
import { PasswordInput } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useCreateAuthHook } from "@/modules/developer/api/auth-hooks";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { FormFailure, fieldError } from "../form-parts";

/** The server waits this long for each hook, and runs them one after another. */
export const HOOK_SECONDS = 3;

/** Add hook: the endpoint, the secret it checks each call with (yours; never shown again), and
 * what happens to a sign-in when it can't answer. It runs on every sign-in once it's added. */
export function AddHookDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const createM = useCreateAuthHook();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(
    () =>
      z.object({
        url: z.url({ protocol: /^https?$/, error: t("webhookDrawer.urlInvalid") }),
        secret: z.string().min(1, t("hookDrawer.secretRequired")),
        failOpen: z.enum(["allow", "block"]),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { url: "", secret: "", failOpen: "allow" as "allow" | "block" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      await runSensitive({
        actionLabel: t("hookDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({
            url: value.url.trim(),
            secret: value.secret,
            fail_open: value.failOpen === "allow",
          }),
      })
        .then((res) => res && onOpenChange(false))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err, { fail_open: "failOpen" });
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
        title={t("hookDrawer.title")}
        description={t("hookDrawer.description")}
        size="md"
      >
        <DrawerBody>
          <form
            id="hook-drawer"
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
                  label={t("hookDrawer.url")}
                  type="url"
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  onBlur={field.handleBlur}
                  placeholder={t("hookDrawer.urlPlaceholder")}
                  description={t("hookDrawer.urlHelp", { seconds: HOOK_SECONDS })}
                  autoComplete="off"
                  error={fieldError(field.state.meta.errors)}
                />
              )}
            </form.Field>
            <form.Field name="secret">
              {(field) => (
                <Field
                  label={t("hookDrawer.secret")}
                  description={
                    fieldError(field.state.meta.errors) ? undefined : t("hookDrawer.secretHelp")
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
            <form.Field name="failOpen">
              {(field) => (
                <RadioGroup
                  label={t("hookDrawer.cantAnswer")}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as "allow" | "block")}
                >
                  <Radio
                    value="allow"
                    label={
                      <span className="dev-choice">
                        {t("hookDrawer.allow")}
                        <Badge tone="brand" size="sm">
                          {t("keyDrawer.recommended")}
                        </Badge>
                      </span>
                    }
                    description={t("hookDrawer.allowHelp")}
                  />
                  <Radio
                    value="block"
                    label={t("hookDrawer.block")}
                    description={t("hookDrawer.blockHelp")}
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
              <Button type="submit" form="hook-drawer" icon={ArrowRightIcon} loading={submitting}>
                {t("hookDrawer.submit")}
              </Button>
            )}
          </form.Subscribe>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
