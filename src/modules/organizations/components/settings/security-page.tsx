import { KeyRoundIcon, NetworkIcon } from "@qeetrix/icons";
import { Badge, Button, formatDate, Link } from "@qeetrix/react";
import { PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type AuthPolicy, useAuthPolicy } from "@/modules/authentication";
import { PageBreadcrumb } from "@/modules/dashboard";
import {
  type SecurityPolicy,
  useSaveSecurityPolicy,
  useSecurityPolicy,
} from "@/modules/organizations/api/security-policy";
import { useUserStats } from "@/modules/users";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useSensitiveAction } from "@/platform/security/sensitive-action-provider";
import {
  ChangeButton,
  ChoiceRule,
  FactorsEditor,
  MfaRuleEditor,
  type SavePolicy,
  SessionLimitEditor,
} from "./security-rules";
import {
  durationMinutes,
  durationString,
  graceEnd,
  IDLE_CHOICES,
  isMfaMode,
  MAX_AGE_CHOICES,
  STEP_UP_METHODS,
  WINDOW_CHOICES,
  withCurrent,
} from "./security-model";
import { Detail, Item, LoadFailed, Loading, Section } from "./settings-parts";
import { useOrgName } from "./use-org-name";
import "./settings.css";

type Editing = "mfa" | "maxAge" | "idle" | "sessions" | "window" | "factors" | null;

/**
 * Settings › Security: the organisation's sign-in rules only, each a fact changed where it sits —
 * who needs two-step verification, sessions, and confirming sensitive actions. Every rule here is
 * enforced by the server. Password rules are Sign-in › Password's (the server enforces only those:
 * /policy's password fields are stored and never read), networks are IP rules', and your own
 * two-step setup is My account's: each is one link, not a copy.
 */
export function SecurityPolicyPage() {
  const { t } = useTranslation("organizations");
  const name = useOrgName();
  const policyQ = useSecurityPolicy();
  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("settings.security.title")}
        description={
          <Trans
            t={t}
            i18nKey="settings.security.description"
            values={{ name }}
            components={{ account: <Link render={<RouterLink to="/account/security" />} /> }}
          />
        }
      />
      <PageContent width="narrow">
        {policyQ.data ? (
          <PolicyRules saved={policyQ.data} name={name} />
        ) : policyQ.isError ? (
          <LoadFailed error={policyQ.error} onRetry={() => void policyQ.refetch()} />
        ) : (
          <Loading rows={5} />
        )}
      </PageContent>
    </>
  );
}

function PolicyRules({ saved, name }: { saved: SecurityPolicy; name: string }) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const access = useCapabilities();
  const canEdit = access.can("policy.write");
  const runSensitive = useSensitiveAction();
  const saveM = useSaveSecurityPolicy();
  const stats = useUserStats(access.can("user.read")).data;
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);

  // The policy is one object the server replaces whole; a rule's change is sent on the saved rest.
  // PUT /policy needs a recent second step: the Save that sent it is the confirmation.
  const save: SavePolicy = (patch) =>
    runSensitive({
      capability: "policy.write",
      actionLabel: t("settings.security.actionLabel"),
      run: () => saveM.mutateAsync({ ...saved, ...patch }),
    });

  const mode = isMfaMode(saved.mfa_enforcement) ? saved.mfa_enforcement : "optional";
  const until = graceEnd(saved.mfa_enforced_since, saved.mfa_grace_days);
  const without = stats ? Math.max(0, stats.total - stats.mfa_enabled) : undefined;
  const maxAge = durationMinutes(saved.session_max_age);
  const idle = durationMinutes(saved.session_idle_timeout);
  const stepUpWindow = durationMinutes(saved.step_up_window);
  const factors = saved.step_up_methods ?? STEP_UP_METHODS;
  const date = (value: Date | string) => formatDate(value, locale, { dateStyle: "long" });

  const mfaHint = [
    stats ? t("settings.security.mfa.coverage", { n: stats.mfa_enabled, total: stats.total }) : "",
    mode !== "optional" && saved.mfa_enforced_since
      ? until && until.getTime() > Date.now()
        ? t("settings.security.mfa.graceRunning", {
            since: date(saved.mfa_enforced_since),
            until: date(until),
          })
        : t("settings.security.mfa.since", { since: date(saved.mfa_enforced_since) })
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Section
        title={t("settings.security.mfa.title")}
        status={
          <Badge tone={mode === "optional" ? "warning" : "success"} size="sm">
            {t(`settings.security.mfa.badge.${mode}`)}
          </Badge>
        }
        description={t("settings.security.mfa.description")}
      >
        <dl className="account-details">
          {editing === "mfa" ? (
            <MfaRuleEditor saved={saved} without={without} save={save} onClose={close} />
          ) : (
            <Detail
              label={t("settings.security.mfa.who")}
              hint={mfaHint || undefined}
              action={
                canEdit ? (
                  <ChangeButton
                    label={t("settings.security.mfa.who")}
                    onClick={() => setEditing("mfa")}
                  />
                ) : undefined
              }
            >
              {t(`settings.security.mfa.value.${mode}`)}
            </Detail>
          )}
        </dl>
      </Section>

      <Section
        title={t("settings.security.passwords.title")}
        description={t("settings.security.passwords.description")}
      >
        <ul className="account-rows">
          <Item
            icon={<KeyRoundIcon />}
            name={t("settings.security.passwords.rules")}
            line={<PasswordRulesLine />}
            actions={
              <Button variant="ghost" render={<RouterLink to="/auth/login-methods/password" />}>
                {t("settings.security.passwords.open")}
              </Button>
            }
          />
        </ul>
      </Section>

      <Section
        title={t("settings.security.sessions.title")}
        description={t("settings.security.sessions.description")}
      >
        <dl className="account-details">
          <ChoiceRule
            label={t("settings.security.sessions.maxAge")}
            hint={t("settings.security.sessions.maxAgeHint")}
            value={maxAge}
            choices={withCurrent(MAX_AGE_CHOICES, maxAge)}
            canEdit={canEdit}
            editing={editing === "maxAge"}
            field="session_max_age"
            onEdit={() => setEditing("maxAge")}
            onClose={close}
            save={save}
            // A shorter life also shortens a longer idle timeout, which can't outlast it.
            toPatch={(minutes) => ({
              session_max_age: durationString(minutes),
              session_idle_timeout: durationString(Math.min(idle, minutes)),
            })}
          />
          <ChoiceRule
            label={t("settings.security.sessions.idle")}
            hint={t("settings.security.sessions.idleHint")}
            value={idle}
            choices={withCurrent(
              IDLE_CHOICES.filter((minutes) => minutes <= maxAge),
              idle,
            )}
            canEdit={canEdit}
            editing={editing === "idle"}
            field="session_idle_timeout"
            onEdit={() => setEditing("idle")}
            onClose={close}
            save={save}
            toPatch={(minutes) => ({ session_idle_timeout: durationString(minutes) })}
          />
          {editing === "sessions" ? (
            <SessionLimitEditor saved={saved} save={save} onClose={close} />
          ) : (
            <Detail
              label={t("settings.security.sessions.perPerson")}
              hint={
                saved.max_sessions === null
                  ? t("settings.security.sessions.perPersonHint")
                  : saved.session_limit_action === "refuse"
                    ? t("settings.security.sessions.atLimitRefuse")
                    : t("settings.security.sessions.atLimitEvict")
              }
              action={
                canEdit ? (
                  <ChangeButton
                    label={t("settings.security.sessions.perPerson")}
                    onClick={() => setEditing("sessions")}
                  />
                ) : undefined
              }
            >
              {saved.max_sessions === null
                ? t("settings.security.sessions.noLimit")
                : t("settings.security.sessions.atMost", { n: saved.max_sessions })}
            </Detail>
          )}
        </dl>
      </Section>

      <Section
        title={t("settings.security.stepUp.title")}
        description={t("settings.security.stepUp.description")}
      >
        <dl className="account-details">
          <ChoiceRule
            label={t("settings.security.stepUp.window")}
            hint={t("settings.security.stepUp.windowHint")}
            value={stepUpWindow}
            choices={withCurrent(WINDOW_CHOICES, stepUpWindow)}
            canEdit={canEdit}
            editing={editing === "window"}
            field="step_up_window"
            onEdit={() => setEditing("window")}
            onClose={close}
            save={save}
            toPatch={(minutes) => ({ step_up_window: durationString(minutes) })}
          />
          {editing === "factors" ? (
            <FactorsEditor saved={saved} save={save} onClose={close} />
          ) : (
            <Detail
              label={t("settings.security.stepUp.factors")}
              hint={new Intl.ListFormat(locale, { type: "conjunction" }).format(
                factors.map((method) => t(`settings.security.stepUp.method.${method}`)),
              )}
              action={
                canEdit ? (
                  <ChangeButton
                    label={t("settings.security.stepUp.factors")}
                    onClick={() => setEditing("factors")}
                  />
                ) : undefined
              }
            >
              {factors.length === STEP_UP_METHODS.length
                ? t("settings.security.stepUp.all", { n: STEP_UP_METHODS.length })
                : t("settings.security.stepUp.some", {
                    n: factors.length,
                    total: STEP_UP_METHODS.length,
                  })}
            </Detail>
          )}
        </dl>
      </Section>

      <Section title={t("settings.security.network.title")}>
        <ul className="account-rows">
          <Item
            icon={<NetworkIcon />}
            name={t("settings.security.network.rules")}
            line={t("settings.security.network.line", { name })}
            actions={
              <Button variant="ghost" render={<RouterLink to="/security/threats/ip-allowlist" />}>
                {t("settings.security.network.open")}
              </Button>
            }
          />
        </ul>
      </Section>
    </>
  );
}

/** The password rules the server enforces (Sign-in › Password), in one line. */
function PasswordRulesLine() {
  const { t } = useTranslation("organizations");
  const policy = useAuthPolicy().data;
  if (!policy) return <>{t("settings.security.passwords.lineUnknown")}</>;
  return <>{passwordRules(policy, t, formatLocale())}</>;
}

function passwordRules(
  policy: AuthPolicy,
  t: ReturnType<typeof useTranslation<"organizations">>["t"],
  locale: string,
): string {
  if (!policy.password_enabled) return t("settings.security.passwords.off");
  const needs = [
    policy.password_require_uppercase && t("settings.security.passwords.upper"),
    policy.password_require_number && t("settings.security.passwords.number"),
    policy.password_require_symbol && t("settings.security.passwords.symbol"),
  ].filter((part): part is string => !!part);
  const length = t("settings.security.passwords.length", { count: policy.password_min_length });
  return needs.length
    ? t("settings.security.passwords.lengthWith", {
        length,
        needs: new Intl.ListFormat(locale, { type: "conjunction" }).format(needs),
      })
    : length;
}
