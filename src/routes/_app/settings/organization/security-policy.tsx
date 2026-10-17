import {
  Button,
  Card,
  CardContent,
  Checkbox,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@qeetrix/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon, LoaderCircleIcon } from "@qeetrix/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export const Route = createFileRoute("/_app/settings/organization/security-policy")({
  component: PoliciesPage,
});

type Policy = {
  tenant_id: string;
  ip_allowlist: string[] | null;
  ip_denylist: string[] | null;
  password_min_length: number;
  password_complexity: string;
  session_max_age: string;
  session_idle_timeout: string;
  max_sessions: number | null;
  session_limit_action: string;
  mfa_enforcement: string;
  mfa_grace_days: number;
  /** When the requirement was turned on (read-only); null while optional. */
  mfa_enforced_since?: string | null;
  /** How long a step-up keeps sensitive actions unlocked, e.g. "5m" or "1h". */
  step_up_window: string;
  /** The factor types that count as a step-up; null = every one. */
  step_up_methods: StepUpMethod[] | null;
  settings?: Record<string, unknown> | null;
};

type StepUpMethod = "totp" | "recovery_code" | "otp" | "webauthn" | "push";

// The factor types a step-up may be met with, in the order shown.
const STEP_UP_METHODS: StepUpMethod[] = ["webauthn", "totp", "recovery_code", "otp", "push"];

// The step-up windows offered (the server accepts 1m–60m).
const STEP_UP_WINDOWS = ["1m", "5m", "10m", "15m", "30m", "1h"];

const empty: Policy = {
  tenant_id: "",
  ip_allowlist: [],
  ip_denylist: [],
  password_min_length: 8,
  password_complexity: "standard",
  session_max_age: "720h",
  session_idle_timeout: "24h",
  max_sessions: null,
  session_limit_action: "evict_oldest",
  mfa_enforcement: "optional",
  mfa_grace_days: 0,
  step_up_window: "5m",
  step_up_methods: null,
};

function PoliciesPage() {
  const { t } = useTranslation("rbac");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Policy>(empty);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const policyQ = useQuery({
    queryKey: ["policy", tenantId],
    queryFn: () => api<Policy>(`/v1/tenants/${tenantId}/policy`),
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (policyQ.data) setDraft({ ...empty, ...policyQ.data });
  }, [policyQ.data]);

  const saveM = useMutation({
    mutationFn: (body: Policy) =>
      api<Policy>(`/v1/tenants/${tenantId}/policy`, { method: "PUT", body }),
    onSuccess: () => {
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["policy", tenantId] });
    },
    meta: { successMessage: "Security policy saved" },
  });

  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // null means every factor type counts; keep at least one ticked, and send
  // null again once all are.
  const stepUpMethods = draft.step_up_methods ?? STEP_UP_METHODS;
  const toggleStepUpMethod = (m: StepUpMethod, on: boolean) => {
    const next = STEP_UP_METHODS.filter((x) => (x === m ? on : stepUpMethods.includes(x)));
    if (next.length === 0) return;
    set("step_up_methods", next.length === STEP_UP_METHODS.length ? null : next);
  };
  const stepUpWindows = STEP_UP_WINDOWS.includes(draft.step_up_window)
    ? STEP_UP_WINDOWS
    : [draft.step_up_window, ...STEP_UP_WINDOWS];

  // When the saved requirement's grace period ends, while it is still running.
  const saved = policyQ.data;
  const graceEndsAt =
    saved?.mfa_enforced_since && saved.mfa_grace_days > 0
      ? new Date(new Date(saved.mfa_enforced_since).getTime() + saved.mfa_grace_days * 86_400_000)
      : null;
  const graceEnds =
    graceEndsAt && graceEndsAt.getTime() > Date.now()
      ? graceEndsAt.toLocaleDateString(undefined, { dateStyle: "long" })
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("policies.description")} />

      {policyQ.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveM.mutate(draft);
          }}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("policies.network.title")}</CardTitle>
              <CardDescription>{t("policies.network.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ip_allowlist">
                    {t("policies.network.allowlistLabel")}
                  </FieldLabel>
                  <Textarea
                    id="ip_allowlist"
                    rows={3}
                    value={(draft.ip_allowlist ?? []).join("\n")}
                    onChange={(e) =>
                      set(
                        "ip_allowlist",
                        e.target.value
                          .split(/\n+/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                    placeholder="10.0.0.0/8&#10;203.0.113.0/24"
                  />
                  <FieldDescription>{t("policies.network.allowlistHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ip_denylist">
                    {t("policies.network.denylistLabel")}
                  </FieldLabel>
                  <Textarea
                    id="ip_denylist"
                    rows={3}
                    value={(draft.ip_denylist ?? []).join("\n")}
                    onChange={(e) =>
                      set(
                        "ip_denylist",
                        e.target.value
                          .split(/\n+/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("policies.password.title")}</CardTitle>
              <CardDescription>{t("policies.password.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password_min_length">
                      {t("policies.password.minLengthLabel")}
                    </FieldLabel>
                    <Input
                      id="password_min_length"
                      type="number"
                      min={8}
                      max={128}
                      value={draft.password_min_length}
                      onChange={(e) =>
                        set("password_min_length", parseInt(e.target.value || "8", 10))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("policies.password.complexityLabel")}</FieldLabel>
                    <Select
                      value={draft.password_complexity}
                      onValueChange={(v) => set("password_complexity", v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relaxed">
                          {t("policies.password.complexityBasic")}
                        </SelectItem>
                        <SelectItem value="standard">
                          {t("policies.password.complexityStandard")}
                        </SelectItem>
                        <SelectItem value="strict">
                          {t("policies.password.complexityStrict")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("policies.session.title")}</CardTitle>
              <CardDescription>{t("policies.session.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="session_max_age">
                    {t("policies.session.maxAgeLabel")}
                  </FieldLabel>
                  <Input
                    id="session_max_age"
                    value={draft.session_max_age}
                    onChange={(e) => set("session_max_age", e.target.value)}
                    placeholder="720h"
                  />
                  <FieldDescription>{t("policies.session.maxAgeHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="session_idle_timeout">
                    {t("policies.session.idleLabel")}
                  </FieldLabel>
                  <Input
                    id="session_idle_timeout"
                    value={draft.session_idle_timeout}
                    onChange={(e) => set("session_idle_timeout", e.target.value)}
                    placeholder="24h"
                  />
                  <FieldDescription>{t("policies.session.idleHelp")}</FieldDescription>
                </Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="max_sessions">
                      {t("policies.session.maxSessionsLabel")}
                    </FieldLabel>
                    <Input
                      id="max_sessions"
                      type="number"
                      min={1}
                      max={1000}
                      value={draft.max_sessions ?? ""}
                      placeholder={t("policies.session.maxSessionsNone")}
                      onChange={(e) =>
                        set(
                          "max_sessions",
                          e.target.value === "" ? null : Number.parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("policies.session.limitActionLabel")}</FieldLabel>
                    <Select
                      value={draft.session_limit_action}
                      onValueChange={(v) => set("session_limit_action", v ?? "evict_oldest")}
                      disabled={draft.max_sessions === null}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evict_oldest">
                          {t("policies.session.limitEvict")}
                        </SelectItem>
                        <SelectItem value="refuse">{t("policies.session.limitRefuse")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Field>
                <FieldDescription>{t("policies.session.limitHelp")}</FieldDescription>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("policies.mfa.title")}</CardTitle>
              <CardDescription>{t("policies.mfa.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("policies.mfa.modeLabel")}</FieldLabel>
                  <Select
                    value={draft.mfa_enforcement}
                    onValueChange={(v) => set("mfa_enforcement", v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="optional">{t("policies.mfa.optional")}</SelectItem>
                      <SelectItem value="required">{t("policies.mfa.required")}</SelectItem>
                      <SelectItem value="admin_only">{t("policies.mfa.adminOnly")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("policies.mfa.noteHelp")}</FieldDescription>
                </Field>
                {draft.mfa_enforcement !== "optional" && (
                  <Field>
                    <FieldLabel htmlFor="mfa_grace_days">{t("policies.mfa.graceLabel")}</FieldLabel>
                    <Input
                      id="mfa_grace_days"
                      type="number"
                      min={0}
                      max={90}
                      value={draft.mfa_grace_days}
                      onChange={(e) =>
                        set(
                          "mfa_grace_days",
                          e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10),
                        )
                      }
                    />
                    <FieldDescription>
                      {t("policies.mfa.graceHelp")}
                      {graceEnds && ` ${t("policies.mfa.graceEnds", { date: graceEnds })}`}
                    </FieldDescription>
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("policies.stepUp.title")}</CardTitle>
              <CardDescription>{t("policies.stepUp.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field className="sm:w-60">
                  <FieldLabel htmlFor="step_up_window">
                    {t("policies.stepUp.windowLabel")}
                  </FieldLabel>
                  <Select
                    value={draft.step_up_window}
                    onValueChange={(v) => set("step_up_window", v ?? "5m")}
                  >
                    <SelectTrigger id="step_up_window">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stepUpWindows.map((w) => (
                        <SelectItem key={w} value={w}>
                          {t(`policies.stepUp.window.${w}`, { defaultValue: w })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t("policies.stepUp.windowHelp")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("policies.stepUp.methodsLabel")}</FieldLabel>
                  <div className="flex flex-col gap-2 pt-1">
                    {STEP_UP_METHODS.map((m) => (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        {/* A @base-ui custom element: label it with aria-label. */}
                        <Checkbox
                          aria-label={t(`policies.stepUp.method.${m}`)}
                          checked={stepUpMethods.includes(m)}
                          disabled={stepUpMethods.length === 1 && stepUpMethods.includes(m)}
                          onCheckedChange={(c) => toggleStepUpMethod(m, c === true)}
                        />
                        <span aria-hidden>{t(`policies.stepUp.method.${m}`)}</span>
                      </div>
                    ))}
                  </div>
                  <FieldDescription>{t("policies.stepUp.methodsHelp")}</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {saveM.error && (
            <Card className="border-destructive">
              <CardContent className="p-4">
                <FieldError>{errorMessage(saveM.error)}</FieldError>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {savedAt
                ? t("policies.savedAt", { time: savedAt.toLocaleTimeString() })
                : t("policies.unsaved")}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => policyQ.data && setDraft({ ...empty, ...policyQ.data })}
                disabled={saveM.isPending}
              >
                {t("policies.resetBtn")}
              </Button>
              <Button type="submit" disabled={saveM.isPending}>
                {saveM.isPending && <LoaderCircleIcon className="animate-spin" />}
                {saveM.isSuccess && !saveM.isPending && <CheckIcon />}
                {saveM.isPending ? t("policies.savingBtn") : t("policies.saveBtn")}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
