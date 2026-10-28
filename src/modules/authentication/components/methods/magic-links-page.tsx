import { ArrowRightIcon } from "@qeetrix/icons";
import { Button, Radio, RadioGroup, VisuallyHidden } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { type AuthPolicy, useAuthPolicy } from "@/modules/authentication/api/auth-policy";
import { useEmailTemplates } from "@/modules/organizations";
import { useAppForm } from "@/platform/forms/app-form";
import { useCapabilities } from "@/platform/security/capability-provider";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { MethodSection } from "./method-section";
import { Detail, EditingDetail, Failure, LoadFailed, Loading, Section } from "./methods-parts";
import { MethodsArea } from "./sign-in-area";
import { useSavePolicy, useSignInMix } from "./use-policy";

// The lifetimes offered, in minutes; the server takes 5 to 1,440, so a lifetime set elsewhere is
// offered too, as the current one.
const LIFETIMES = [15, 30, 60] as const;
const RECOMMENDED = 15;
const TEMPLATE = "magic_link"; // the email the link is sent in

/**
 * Authentication › Sign-in › Magic links: on or off, how long a link works, and the email it's sent
 * in (edited in Settings › Emails).
 */
export function MagicLinksPage() {
  const { t } = useTranslation("authentication");
  const policy = useAuthPolicy();
  return (
    <MethodsArea title={t("methods.signIn.title")} description={t("methods.signIn.description")}>
      {policy.isPending ? (
        <Loading rows={3} />
      ) : policy.isError ? (
        <LoadFailed error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <MagicLinkSections policy={policy.data} />
      )}
    </MethodsArea>
  );
}

/** A lifetime in the largest whole unit: "30 minutes", "1 hour", "24 hours". */
function useLifetime() {
  const { t } = useTranslation("authentication");
  return (minutes: number) =>
    minutes % 60 === 0
      ? t("magicLinks.hours", { count: minutes / 60 })
      : t("magicLinks.minutes", { count: minutes });
}

function MagicLinkSections({ policy }: { policy: AuthPolicy }) {
  const { t } = useTranslation("authentication");
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  // The email templates need branding.write; without it the email is named, not linked.
  const canEmails = access.can("branding.write");
  const template = useEmailTemplates(canEmails).data?.items.find((e) => e.key === TEMPLATE);
  const used = useSignInMix()?.magic_link;
  const lifetime = useLifetime();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <MethodSection
        policy={policy}
        method="magic_link_enabled"
        canWrite={canWrite}
        title={t("magicLinks.title")}
        description={
          used === undefined
            ? t("magicLinks.description")
            : `${t("magicLinks.description")} ${t("methods.used", { n: used })}`
        }
        turnOff={{
          title: t("magicLinks.turnOffTitle"),
          description: t("magicLinks.turnOffDescription"),
        }}
      />
      <Section title={t("magicLinks.linkTitle")}>
        <dl className="account-details">
          {editing ? (
            <LifetimeEdit policy={policy} onDone={() => setEditing(false)} />
          ) : (
            <Detail
              label={t("magicLinks.worksFor")}
              hint={t("magicLinks.worksForHint")}
              action={
                canWrite && (
                  <Button
                    variant="ghost"
                    aria-label={t("magicLinks.editLifetime")}
                    onClick={() => setEditing(true)}
                  >
                    {t("methods.edit")}
                  </Button>
                )
              }
            >
              {lifetime(policy.magic_link_ttl_minutes)}
            </Detail>
          )}
          <Detail
            label={t("magicLinks.email")}
            hint={
              template
                ? t(template.custom ? "magicLinks.emailCustom" : "magicLinks.emailDefault")
                : t("magicLinks.emailHint")
            }
            action={
              canEmails && (
                <Button
                  variant="ghost"
                  icon={ArrowRightIcon}
                  render={<Link to="/settings/organization/email-templates" />}
                >
                  {t("magicLinks.editEmail")}
                </Button>
              )
            }
          >
            {template?.name ?? t("magicLinks.emailName")}
          </Detail>
        </dl>
      </Section>
    </>
  );
}

/** How long a link works, chosen where it's shown. */
function LifetimeEdit({ policy, onDone }: { policy: AuthPolicy; onDone: () => void }) {
  const { t } = useTranslation("authentication");
  const formId = useId();
  const save = useSavePolicy(policy);
  const lifetime = useLifetime();
  const current = policy.magic_link_ttl_minutes;
  const options = [...new Set<number>([...LIFETIMES, current])].sort((a, b) => a - b);
  const form = useAppForm({
    defaultValues: { minutes: String(current) },
    onSubmit: async ({ value }) => {
      const minutes = Number(value.minutes);
      if (minutes === current) return onDone();
      await save.run({ magic_link_ttl_minutes: minutes }).then(onDone).catch(settleSensitiveAction);
    },
  });
  return (
    <EditingDetail
      label={t("magicLinks.worksFor")}
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
        <form.Field name="minutes">
          {(field) => (
            <RadioGroup
              label={<VisuallyHidden>{t("magicLinks.worksFor")}</VisuallyHidden>}
              orientation="horizontal"
              value={field.state.value}
              onValueChange={(value) => field.handleChange(String(value))}
            >
              {options.map((minutes) => (
                <Radio
                  key={minutes}
                  value={String(minutes)}
                  label={lifetime(minutes)}
                  description={
                    minutes === current
                      ? t("magicLinks.current")
                      : minutes === RECOMMENDED
                        ? t("magicLinks.recommended")
                        : undefined
                  }
                />
              ))}
            </RadioGroup>
          )}
        </form.Field>
        <Failure error={save.error} />
      </form>
    </EditingDetail>
  );
}
