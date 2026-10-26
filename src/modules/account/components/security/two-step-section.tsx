import {
  LifeBuoyIcon,
  MailIcon,
  MessageSquareIcon,
  PlusIcon,
  QrCodeIcon,
  SmartphoneIcon,
} from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  isStepUpRequired,
  type OtpFactor,
  type TotpEnrollment,
  useChallengeOtpFactor,
  useDeleteOtpFactor,
  useDisableTotp,
  useOtpFactors,
  usePushDevices,
  useRecoveryStatus,
  useRegenerateRecoveryCodes,
  useRemovePushDevice,
  useStartTotpEnrollment,
  useTotpStatus,
} from "@/modules/authentication";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { relative } from "@/modules/account/relative-time";
import { Item, LoadFailed, Loading, Section } from "../account-parts";
import { OtpFactorPanel } from "./otp-factor-panel";
import { RecoveryCodesPanel } from "./recovery-codes";

// Both show a QR code, so each loads with its encoder when it opens.
const AuthenticatorSetup = lazy(() => import("./authenticator-setup"));
const LinkPhone = lazy(() => import("./link-phone"));

const SELF = { kind: "self" } as const;

type Open =
  | { kind: "app"; enrollment: TotpEnrollment }
  | { kind: "codes"; codes: string[] }
  | { kind: "phone" }
  | { kind: "otp"; factor?: OtpFactor }
  | null;

function Opening() {
  return (
    <li className="account-panel">
      <Loading rows={1} />
    </li>
  );
}

/**
 * The second step after a password: an authenticator app, phones that approve sign-ins, codes by
 * text message or email, and the recovery codes for when none of them is to hand. Each is set up
 * or removed in its row; setting one up opens under it.
 */
export function TwoStepSection() {
  const { t } = useTranslation("account");
  const runSensitive = useSensitiveAction();
  const totp = useTotpStatus();
  const recovery = useRecoveryStatus().data;
  const factors = useOtpFactors().data?.items ?? [];
  const phones = usePushDevices(SELF).data?.items ?? [];
  const startApp = useStartTotpEnrollment();
  const disableApp = useDisableTotp();
  const regenerate = useRegenerateRecoveryCodes();
  const removeFactor = useDeleteOtpFactor();
  const removePhone = useRemovePushDevice(SELF);
  const challenge = useChallengeOtpFactor();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const appOn = totp.data?.enrolled === true;
  const on = appOn || phones.length > 0 || factors.some((factor) => factor.verified);
  // The hooks below are silent, so a failure toasts here; a cancelled step-up already said so.
  const toastUnlessStepUp = (err: unknown) => {
    if (!isStepUpRequired(err)) toastError(err);
  };

  // A confirmed app keeps working until its replacement is confirmed, so replacing is confirmed.
  const setUpApp = (replacing: boolean) =>
    runSensitive({
      confirm: replacing
        ? {
            title: t("security.app.replaceConfirmTitle"),
            description: t("security.app.replaceConfirmDescription"),
            confirmLabel: t("security.app.replace"),
          }
        : undefined,
      actionLabel: replacing ? t("security.app.replaceTitle") : t("security.app.setupTitle"),
      run: () => startApp.mutateAsync(undefined, { onError: toastUnlessStepUp }),
    })
      .then((enrollment) => enrollment && setOpen({ kind: "app", enrollment }))
      .catch(settleSensitiveAction);

  const turnOffApp = () =>
    runSensitive({
      confirm: {
        title: t("security.app.turnOffConfirmTitle"),
        description: t("security.app.turnOffConfirmDescription"),
        confirmLabel: t("security.app.turnOff"),
        tone: "destructive",
      },
      actionLabel: t("security.app.turnOff"),
      run: () => disableApp.mutateAsync(),
    })
      .then(close)
      .catch(settleSensitiveAction);

  // New codes void the ones already held, so that's confirmed first.
  const newCodes = () =>
    runSensitive({
      confirm:
        (recovery?.total ?? 0) > 0
          ? {
              title: t("security.codes.newConfirmTitle"),
              description: t("security.codes.newConfirmDescription"),
              confirmLabel: t("security.codes.new"),
              tone: "destructive",
            }
          : undefined,
      actionLabel: t("security.codes.new"),
      run: () => regenerate.mutateAsync(undefined, { onError: toastUnlessStepUp }),
    })
      .then((res) => res && setOpen({ kind: "codes", codes: res.recovery_codes }))
      .catch(settleSensitiveAction);

  const removeOtp = (factor: OtpFactor) =>
    runSensitive({
      confirm: {
        title: t("security.otp.removeConfirm", { destination: factor.destination }),
        description: t("security.otp.removeDescription"),
        confirmLabel: t("security.remove"),
        tone: "destructive",
      },
      actionLabel: t("security.otp.removeAction"),
      run: () => removeFactor.mutateAsync(factor.id),
    }).catch(settleSensitiveAction);

  const finishOtp = (factor: OtpFactor) =>
    challenge.mutate(factor.id, { onSuccess: () => setOpen({ kind: "otp", factor }) });

  const unlinkPhone = (id: string, name: string) =>
    runSensitive({
      confirm: {
        title: t("security.phones.removeConfirm", { name }),
        description: t("security.phones.removeDescription"),
        confirmLabel: t("security.phones.remove"),
        tone: "destructive",
      },
      actionLabel: t("security.phones.removeAction"),
      run: () => removePhone.mutateAsync(id, { onError: toastUnlessStepUp }),
    })
      .then((done) => done !== undefined && toast.success(t("security.phones.removed")))
      .catch(settleSensitiveAction);

  const ghost = (label: string, onClick: () => void, aria?: string) => (
    <Button variant="ghost" aria-label={aria} onClick={onClick}>
      {label}
    </Button>
  );

  return (
    <Section
      title={t("security.twoStep.title")}
      status={
        totp.isSuccess && (
          <Badge tone={on ? "success" : "neutral"} size="sm">
            {on ? t("security.on") : t("security.off")}
          </Badge>
        )
      }
      description={t("security.twoStep.description")}
    >
      {totp.isPending ? (
        <Loading rows={3} />
      ) : totp.isError ? (
        <LoadFailed error={totp.error} onRetry={() => void totp.refetch()} />
      ) : (
        <>
          <ul className="account-rows">
            {open?.kind === "app" ? (
              <Suspense fallback={<Opening />}>
                <AuthenticatorSetup
                  enrollment={open.enrollment}
                  onConfirmed={(codes) => setOpen({ kind: "codes", codes })}
                  onCancel={close}
                />
              </Suspense>
            ) : (
              <Item
                icon={<QrCodeIcon />}
                name={t("security.app.name")}
                badge={
                  appOn && (
                    <Badge tone="success" size="sm">
                      {t("security.on")}
                    </Badge>
                  )
                }
                line={t("security.app.line")}
                actions={
                  appOn ? (
                    <>
                      {ghost(t("security.app.replace"), () => void setUpApp(true))}
                      {ghost(t("security.app.turnOff"), () => void turnOffApp())}
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      loading={startApp.isPending}
                      onClick={() => void setUpApp(false)}
                    >
                      {t("security.app.setUp")}
                    </Button>
                  )
                }
              />
            )}
            {phones.map((phone) => {
              const name = phone.name || t(`security.phones.platform.${phone.platform}`);
              return (
                <Item
                  key={phone.id}
                  icon={<SmartphoneIcon />}
                  name={name}
                  line={t("security.phone.line", {
                    linked: relative(phone.created_at),
                    used: relative(phone.last_seen_at),
                  })}
                  actions={ghost(
                    t("security.remove"),
                    () => void unlinkPhone(phone.id, name),
                    t("security.removeNamed", { name }),
                  )}
                />
              );
            })}
            {factors.map((factor) => (
              <Item
                key={factor.id}
                icon={factor.channel === "sms" ? <MessageSquareIcon /> : <MailIcon />}
                name={t(`security.otp.${factor.channel}Name`)}
                badge={
                  !factor.verified && (
                    <Badge tone="warning" size="sm">
                      {t("security.otp.unconfirmed")}
                    </Badge>
                  )
                }
                line={t("security.otp.line", {
                  destination: factor.destination,
                  added: relative(factor.created_at),
                })}
                actions={
                  <>
                    {!factor.verified && ghost(t("security.otp.finish"), () => finishOtp(factor))}
                    {ghost(
                      t("security.remove"),
                      () => void removeOtp(factor),
                      t("security.removeNamed", { name: factor.destination }),
                    )}
                  </>
                }
              />
            ))}
            {open?.kind === "codes" ? (
              <RecoveryCodesPanel as="li" codes={open.codes} onDone={close} />
            ) : (
              (appOn || recovery?.enrolled) && (
                <Item
                  icon={<LifeBuoyIcon />}
                  name={t("security.codes.name")}
                  line={
                    recovery && recovery.total > 0
                      ? t("security.codes.line", {
                          remaining: recovery.remaining,
                          total: recovery.total,
                        })
                      : t("security.codes.lineNone")
                  }
                  actions={
                    <Button variant="ghost" loading={regenerate.isPending} onClick={newCodes}>
                      {t("security.codes.new")}
                    </Button>
                  }
                />
              )
            )}
            {open?.kind === "phone" && (
              <Suspense fallback={<Opening />}>
                <LinkPhone onClose={close} />
              </Suspense>
            )}
            {open?.kind === "otp" && (
              <OtpFactorPanel key={open.factor?.id} factor={open.factor} onClose={close} />
            )}
          </ul>
          {open?.kind !== "phone" && open?.kind !== "otp" && (
            <div className="account-adds">
              <Button variant="ghost" icon={PlusIcon} onClick={() => setOpen({ kind: "phone" })}>
                {t("security.phone.link")}
              </Button>
              <Button variant="ghost" icon={PlusIcon} onClick={() => setOpen({ kind: "otp" })}>
                {t("security.otp.add")}
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
