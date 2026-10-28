import { MailIcon, MessageSquareIcon, PlusIcon } from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type OtpFactor,
  useChallengeOtpFactor,
  useDeleteOtpFactor,
  useOtpFactors,
} from "@/modules/authentication/api/mfa";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Item, LoadFailed, Loading, Section, when } from "./methods-parts";
import { OtpFactorPanel } from "./otp-factor-panel";
import { MethodsArea } from "./sign-in-area";

type Open = { factor?: OtpFactor } | null;

/**
 * Authentication › MFA › SMS / email: the signed-in person's own numbers and addresses for sign-in
 * codes (the same as My account › Security, kept here for now). Each can be sent a test code or
 * removed; adding one, or finishing one not yet confirmed, opens under the list.
 */
export function OtpFactorsPage() {
  const { t } = useTranslation("authentication");
  return (
    <MethodsArea title={t("methods.mfa.title")} description={t("methods.mfa.description")}>
      <OtpFactors />
    </MethodsArea>
  );
}

function OtpFactors() {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const factors = useOtpFactors();
  const challenge = useChallengeOtpFactor();
  const remove = useDeleteOtpFactor();
  const [open, setOpen] = useState<Open>(null);
  const items = factors.data?.items ?? [];

  const removeOne = (factor: OtpFactor) =>
    runSensitive({
      confirm: {
        title: t("otp.removeTitle", { destination: factor.destination }),
        description: t("otp.removeDescription"),
        confirmLabel: t("methods.remove"),
        tone: "destructive",
      },
      actionLabel: t("otp.removeAction"),
      run: () => remove.mutateAsync(factor.id),
    }).catch(settleSensitiveAction);

  // An unconfirmed one gets a new code, then opens on the code.
  const finish = (factor: OtpFactor) =>
    challenge.mutate(factor.id, { onSuccess: () => setOpen({ factor }) });

  return (
    <Section title={t("otp.title")} description={t("otp.description")}>
      {factors.isPending ? (
        <Loading />
      ) : factors.isError ? (
        <LoadFailed error={factors.error} onRetry={() => void factors.refetch()} />
      ) : (
        <>
          {(items.length > 0 || open) && (
            <ul className="account-rows">
              {items.map((factor) => (
                <Item
                  key={factor.id}
                  icon={factor.channel === "sms" ? <MessageSquareIcon /> : <MailIcon />}
                  name={t(`otp.channels.${factor.channel}`)}
                  badge={
                    !factor.verified && (
                      <Badge tone="warning" size="sm">
                        {t("otp.unconfirmed")}
                      </Badge>
                    )
                  }
                  line={t("otp.line", {
                    destination: factor.destination,
                    added: when(factor.created_at),
                  })}
                  actions={
                    <>
                      {factor.verified ? (
                        <Button
                          variant="ghost"
                          aria-label={t("otp.sendTestNamed", { destination: factor.destination })}
                          loading={challenge.isPending && challenge.variables === factor.id}
                          onClick={() => challenge.mutate(factor.id)}
                        >
                          {t("otp.sendTest")}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          aria-label={t("otp.finishNamed", { destination: factor.destination })}
                          loading={challenge.isPending && challenge.variables === factor.id}
                          onClick={() => finish(factor)}
                        >
                          {t("otp.finish")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        aria-label={t("methods.removeNamed", { name: factor.destination })}
                        disabled={remove.isPending && remove.variables === factor.id}
                        onClick={() => void removeOne(factor)}
                      >
                        {t("methods.remove")}
                      </Button>
                    </>
                  }
                />
              ))}
              {open && (
                <OtpFactorPanel
                  key={open.factor?.id ?? "new"}
                  factor={open.factor}
                  onClose={() => setOpen(null)}
                />
              )}
            </ul>
          )}
          {items.length === 0 && !open && <p className="account-note">{t("otp.empty")}</p>}
          {!open && (
            <div className="account-adds">
              <Button variant="ghost" icon={PlusIcon} onClick={() => setOpen({})}>
                {t("otp.add")}
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
