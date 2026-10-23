import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { TrashIcon, ZapIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useAuthHooks,
  useCreateAuthHook,
  useDeleteAuthHook,
  useUpdateAuthHook,
} from "../api/auth-hooks";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders the tenant's auth hooks: the add form and the list with enable and remove. */
export function AuthHooksPage() {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const hooksQ = useAuthHooks();
  const updateM = useUpdateAuthHook();
  const deleteM = useDeleteAuthHook();

  const items = hooksQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("authHooks.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("authHooks.add.title")}</CardTitle>
          <CardDescription>{t("authHooks.add.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AddAuthHookForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("authHooks.list.title")}</CardTitle>
          <CardDescription>{t("authHooks.list.description")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={hooksQ.isLoading}
            isError={hooksQ.isError}
            error={hooksQ.error}
            isEmpty={items.length === 0}
            emptyIcon={ZapIcon}
            emptyTitle={t("authHooks.list.empty")}
            emptyDescription={t("authHooks.list.emptyDescription")}
            skeletonRows={2}
          >
            <ul className="divide-y">
              {items.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate font-mono">{h.url}</span>
                      <Badge variant={h.fail_open ? "outline" : "destructive"}>
                        {h.fail_open
                          ? t("authHooks.list.failOpen")
                          : t("authHooks.list.failClosed")}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {h.trigger} · added <TimeSince value={h.created_at} />
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={h.enabled}
                      aria-label={t("authHooks.list.enabledAriaLabel")}
                      disabled={updateM.isPending}
                      onCheckedChange={(v) =>
                        runSensitive({
                          actionLabel: v
                            ? t("authHooks.stepUp.enable")
                            : t("authHooks.stepUp.disable"),
                          run: () =>
                            updateM.mutateAsync({ id: h.id, enabled: v, fail_open: h.fail_open }),
                        }).catch(settleSensitiveAction)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteM.isPending}
                      onClick={() =>
                        runSensitive({
                          confirm: {
                            title: t("authHooks.confirm.removeTitle"),
                            confirmLabel: t("authHooks.confirm.removeLabel"),
                            tone: "destructive",
                          },
                          actionLabel: t("authHooks.stepUp.remove"),
                          run: () => deleteM.mutateAsync(h.id),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      <TrashIcon /> {t("authHooks.list.remove")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

/** Renders the inline form that adds an auth hook. */
function AddAuthHookForm() {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const createM = useCreateAuthHook();
  const schema = useMemo(
    () =>
      z.object({
        url: z.url({ protocol: /^https?$/, error: t("authHooks.add.validation.url") }),
        secret: z.string(),
        fail_open: z.boolean(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { url: "", secret: "", fail_open: true },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("authHooks.stepUp.add"),
        run: () =>
          createM.mutateAsync({ ...value, url: value.url.trim(), secret: value.secret.trim() }),
      })
        .then(() => formApi.reset())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <form.AppField name="url">
            {(field) => (
              <field.TextField
                label={t("authHooks.add.url")}
                placeholder={t("authHooks.add.urlPlaceholder")}
                type="url"
                required
              />
            )}
          </form.AppField>
        </div>
        <div className="sm:w-56">
          <form.AppField name="secret">
            {(field) => (
              <field.PasswordField
                label={t("authHooks.add.secret")}
                placeholder={t("authHooks.add.secretPlaceholder")}
                autoComplete="off"
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton>{t("authHooks.add.submit")}</form.SubmitButton>
        </form.AppForm>
      </div>
      <form.AppField name="fail_open">
        {(field) => (
          <field.SwitchField
            label={t("authHooks.add.failOpen")}
            description={t("authHooks.add.failOpenDescription")}
          />
        )}
      </form.AppField>
      <FormError error={createM.error} />
    </form>
  );
}
