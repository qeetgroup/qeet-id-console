import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
} from "@qeetrix/ui";
import { CircleCheckIcon, CircleXIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { type ExplainPath, useExplainCheck } from "../api/access-check";
import { explainDecidedBy, explainedMessage, explainReasonFields } from "./explain/decision-reason";

/** Renders the access tester: one permission check, explained. */
export function AccessTesterPage() {
  const { t } = useTranslation("rbac");
  const checkM = useExplainCheck();
  const result = checkM.data;
  // A denial states its own reason; either answer may say what decided it.
  const why = result
    ? (!result.allowed && explainReasonFields(result)) || explainDecidedBy(result.decided_by)
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={t("check.title")} description={t("check.description")} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("check.runTitle")}</CardTitle>
            <CardDescription>{t("check.runDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CheckForm check={checkM} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("check.resultTitle")}</CardTitle>
            <CardDescription>{t("check.resultDescription")}</CardDescription>
          </CardHeader>
          {/* No toast for the result, so a polite live region announces allow or deny. */}
          <CardContent aria-live="polite">
            {!result ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ShieldCheckIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("check.resultPlaceholder")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    result.allowed
                      ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {result.allowed ? (
                    <CircleCheckIcon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleXIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {result.allowed ? t("check.allowed") : t("check.denied")}
                    </p>
                    {(why || !result.allowed) && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {why ? explainedMessage(why, t) : t("check.deniedReason")}
                      </p>
                    )}
                  </div>
                </div>

                {result.allowed && (
                  <section>
                    <h3 className="text-sm font-medium">{t("check.grantPathsTitle")}</h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {t("check.grantPathsHint")}
                    </p>
                    {result.paths.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("check.noGrantPath")}</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {result.paths.map((p) => (
                          // One path per role, directly or per group (unique server-side).
                          <GrantPathRow key={`${p.role_id}-${p.group_id ?? p.via}`} path={p} />
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GrantPathRow({ path }: { path: ExplainPath }) {
  const { t } = useTranslation("rbac");
  const isGroup = path.via.startsWith("group:");
  const viaLabel = isGroup
    ? t("check.viaGroup", { group: path.via.slice("group:".length) })
    : t("check.directAssignment");
  return (
    <li className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" className="font-mono">
          {path.permission}
        </Badge>
        <span className="text-xs text-muted-foreground">{t("check.grantedBy")}</span>
        <Badge variant="secondary">{path.granted_by}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isGroup ? "outline" : "muted"}>{viaLabel}</Badge>
        <span className="font-mono text-[10px] text-muted-foreground">
          {t("check.roleShort", { id: path.role_id.slice(0, 8) })}
        </span>
      </div>
    </li>
  );
}

/** Renders the check's inputs: whose access, and to which permission. */
function CheckForm({ check }: { check: ReturnType<typeof useExplainCheck> }) {
  const { t } = useTranslation("rbac");
  const schema = useMemo(
    () =>
      z.object({
        user_id: z.guid(t("check.validation.userId")),
        permission: z.string().trim().min(1, t("check.validation.permission")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { user_id: "", permission: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await check
        .mutateAsync({ user_id: value.user_id.trim(), permission: value.permission.trim() })
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.AppField name="user_id">
          {(field) => (
            <field.TextField
              label={t("check.userIdLabel")}
              description={t("check.userIdHelp")}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="font-mono text-xs"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="permission">
          {(field) => (
            <field.TextField label={t("check.permissionLabel")} placeholder="user.read" required />
          )}
        </form.AppField>
        <FormError error={check.error} />
      </FieldGroup>
      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton icon={<ShieldCheckIcon />} pendingLabel={t("check.evaluating")}>
            {t("check.evaluate")}
          </form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}
