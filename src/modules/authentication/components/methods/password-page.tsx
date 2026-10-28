import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  formatNumber,
  VisuallyHidden,
} from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { formatLocale } from "@/i18n";
import { type AuthPolicy, useAuthPolicy } from "@/modules/authentication/api/auth-policy";
import { useUserStats } from "@/modules/users";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import { useCapabilities } from "@/platform/security/capability-provider";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { MethodSection } from "./method-section";
import { LockoutSection } from "./password-lockout";
import { Detail, EditingDetail, Failure, LoadFailed, Loading, Section } from "./methods-parts";
import { MethodsArea } from "./sign-in-area";
import { useSavePolicy, useSignInMix, useTwoStepRule } from "./use-policy";

// The server clamps a minimum length to 8–128 characters.
const LENGTH = { min: 8, max: 128 } as const;
const CLASSES = ["uppercase", "number", "symbol"] as const;
type CharacterClass = (typeof CLASSES)[number];
const CLASS_FIELD = {
  uppercase: "password_require_uppercase",
  number: "password_require_number",
  symbol: "password_require_symbol",
} as const satisfies Record<CharacterClass, keyof AuthPolicy>;

/**
 * Authentication › Sign-in › Password: password sign-in on or off, the rules every new password
 * meets, the lockout after wrong passwords, and where the two-step rule is set. The only place
 * the password rules are set: the server enforces these, not Settings › Security's.
 */
export function PasswordPage() {
  const { t } = useTranslation("authentication");
  const policy = useAuthPolicy();
  return (
    <MethodsArea title={t("methods.signIn.title")} description={t("methods.signIn.description")}>
      {policy.isPending ? (
        <Loading rows={4} />
      ) : policy.isError ? (
        <LoadFailed error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <PasswordSections policy={policy.data} />
      )}
    </MethodsArea>
  );
}

function PasswordSections({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation("authentication");
  const canWrite = useCapabilities().can("policy.write");
  const mix = useSignInMix();
  const used = mix?.password;
  return (
    <>
      <MethodSection
        policy={policy}
        method="password_enabled"
        canWrite={canWrite}
        title={t("password.title")}
        description={
          used === undefined
            ? t("password.description")
            : `${t("password.description")} ${t("methods.used", { n: used })}`
        }
        turnOff={{
          title: t("password.turnOffTitle"),
          description: t("password.turnOffDescription"),
        }}
      />
      <RulesSection policy={policy} canWrite={canWrite} />
      {policy.lockout_limits && (
        <LockoutSection policy={policy} limits={policy.lockout_limits} canWrite={canWrite} />
      )}
      <TwoStepSection />
    </>
  );
}

/* ── Rules for new passwords ──────────────────────────────────────────────── */

function RulesSection({ policy, canWrite }: { policy: AuthPolicy; canWrite: boolean }) {
  const { t } = useTranslation("authentication");
  const [editing, setEditing] = useState<"length" | "include" | null>(null);
  const locale = formatLocale();
  const list = (items: string[]) =>
    new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  const required = CLASSES.filter((c) => policy[CLASS_FIELD[c]]);
  const optional = CLASSES.filter((c) => !policy[CLASS_FIELD[c]]);
  const words = (classes: readonly CharacterClass[]) =>
    classes.map((c) => t(`password.classes.${c}`));
  const edit = (what: "length" | "include") => (
    <Button
      variant="ghost"
      aria-label={t(what === "length" ? "password.editLength" : "password.editInclude")}
      onClick={() => setEditing(what)}
    >
      {t("methods.edit")}
    </Button>
  );

  return (
    <Section title={t("password.rulesTitle")} description={t("password.rulesDescription")}>
      <dl className="account-details">
        {editing === "length" ? (
          <MinLengthEdit policy={policy} onDone={() => setEditing(null)} />
        ) : (
          <Detail
            label={t("password.minLength")}
            hint={t("password.minLengthHint", LENGTH)}
            action={canWrite && edit("length")}
          >
            {t("password.characters", { count: policy.password_min_length })}
          </Detail>
        )}
        {editing === "include" ? (
          <IncludeEdit policy={policy} onDone={() => setEditing(null)} />
        ) : (
          <Detail
            label={t("password.mustInclude")}
            hint={
              optional.length > 0 &&
              required.length > 0 &&
              t("password.notRequired", {
                count: optional.length,
                items: capitalise(list(words(optional))),
              })
            }
            action={canWrite && edit("include")}
          >
            {required.length > 0 ? capitalise(list(words(required))) : t("password.includeNothing")}
          </Detail>
        )}
        <Detail label={t("password.alwaysRefused")} hint={t("password.alwaysRefusedHint")}>
          {t("password.alwaysRefusedValue")}
        </Detail>
      </dl>
    </Section>
  );
}

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The minimum length, changed where it's shown. */
function MinLengthEdit({ policy, onDone }: { policy: AuthPolicy; onDone: () => void }) {
  const { t } = useTranslation("authentication");
  const formId = useId();
  const save = useSavePolicy(policy);
  const message = t("password.minLengthRange", LENGTH);
  const form = useAppForm({
    defaultValues: { password_min_length: policy.password_min_length as number | null },
    validators: {
      onSubmit: z.object({
        password_min_length: z
          .number()
          .int(message)
          .min(LENGTH.min, message)
          .max(LENGTH.max, message)
          .nullable()
          .refine((value) => value !== null, message),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      if (value.password_min_length === policy.password_min_length) return onDone();
      await save
        .run({ password_min_length: value.password_min_length ?? policy.password_min_length })
        .then(onDone)
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });
  return (
    <EditingDetail
      label={t("password.minLength")}
      buttons={
        <>
          <Button variant="ghost" onClick={onDone}>
            {t("methods.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.pending}>
            {t("methods.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="password_min_length">
          {(field) => (
            <field.NumberField
              label={<VisuallyHidden>{t("password.minLength")}</VisuallyHidden>}
              description={t("password.minLengthUnit", LENGTH)}
              min={LENGTH.min}
              max={LENGTH.max}
              step={1}
              inputMode="numeric"
              autoFocus
            />
          )}
        </form.AppField>
        <Failure error={save.error} />
      </form>
    </EditingDetail>
  );
}

/** Which kinds of character a new password must hold, changed where they're shown. */
function IncludeEdit({ policy, onDone }: { policy: AuthPolicy; onDone: () => void }) {
  const { t } = useTranslation("authentication");
  const formId = useId();
  const save = useSavePolicy(policy);
  const form = useAppForm({
    defaultValues: { include: CLASSES.filter((c) => policy[CLASS_FIELD[c]]) as string[] },
    onSubmit: async ({ value }) => {
      const change = Object.fromEntries(
        CLASSES.map((c) => [CLASS_FIELD[c], value.include.includes(c)]),
      );
      if (CLASSES.every((c) => change[CLASS_FIELD[c]] === policy[CLASS_FIELD[c]])) return onDone();
      await save.run(change).then(onDone).catch(settleSensitiveAction);
    },
  });
  return (
    <EditingDetail
      label={t("password.mustInclude")}
      buttons={
        <>
          <Button variant="ghost" onClick={onDone}>
            {t("methods.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={save.pending}>
            {t("methods.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="include">
          {(field) => (
            <CheckboxGroup
              label={<VisuallyHidden>{t("password.mustInclude")}</VisuallyHidden>}
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
            >
              {CLASSES.map((c) => (
                <Checkbox key={c} value={c} label={capitalise(t(`password.classes.${c}`))} />
              ))}
            </CheckboxGroup>
          )}
        </form.Field>
        <Failure error={save.error} />
      </form>
    </EditingDetail>
  );
}

/* ── Two-step verification: set in Settings › Security ───────────────────── */

const RULES = ["optional", "required", "admin_only"] as const;
type Rule = (typeof RULES)[number];
const isRule = (value: string | undefined): value is Rule => RULES.some((rule) => rule === value);

/**
 * Where the second step's rule lives, with how many people have one: the rule itself is Settings ›
 * Security's, so this only points there.
 */
function TwoStepSection() {
  const { t } = useTranslation("authentication");
  const access = useCapabilities();
  const rule = useTwoStepRule(true).data;
  const stats = useUserStats(access.can("user.read")).data;
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const without = stats ? stats.total - stats.mfa_enabled : 0;
  return (
    <Section
      title={t("password.twoStep.title")}
      status={
        isRule(rule) && (
          <Badge size="sm" tone={rule === "optional" ? "neutral" : "success"}>
            {t(`password.twoStep.rules.${rule}`)}
          </Badge>
        )
      }
      description={
        stats
          ? `${t("password.twoStep.count", { n: n(stats.mfa_enabled), total: n(stats.total) })} ${t("password.twoStep.where")}`
          : t("password.twoStep.where")
      }
      action={
        <Button
          variant="ghost"
          className="am-head-action"
          icon={ArrowRightIcon}
          // A Button rendered as a link is announced as a button until QTRX-8.
          render={<Link to="/settings/organization/security-policy" />}
        >
          {t("password.twoStep.link")}
        </Button>
      }
    >
      {stats && without > 0 && (
        <p className="account-note">
          <Link to="/users" search={{ twostep: "off" }}>
            {t("password.twoStep.without", { n: n(without) })}
          </Link>
        </p>
      )}
    </Section>
  );
}
