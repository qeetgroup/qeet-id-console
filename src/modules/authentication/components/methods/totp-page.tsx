import { LifeBuoyIcon, QrCodeIcon } from "@qeetrix/icons";
import { Badge, Button } from "@qeetrix/react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  type TotpEnrollment,
  useDisableTotp,
  useRecoveryStatus,
  useRegenerateRecoveryCodes,
  useStartTotpEnrollment,
  useTotpStatus,
} from "@/modules/authentication/api/mfa";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import { Item, LoadFailed, Loading, Section } from "./methods-parts";
import { RecoveryCodesPanel } from "./recovery-codes-panel";
import { MethodsArea } from "./sign-in-area";

// It shows a QR code, so it loads with its encoder when setup starts.
const AuthenticatorSetup = lazy(() => import("./authenticator-setup"));

// Fewer left than this, and the row says to get new ones.
const LOW_CODES = 3;

type Open = { kind: "app"; enrollment: TotpEnrollment } | { kind: "codes"; codes: string[] } | null;

/**
 * Authentication › MFA › TOTP: the signed-in person's own authenticator app and the recovery codes
 * that back it (the same as My account › Security, kept here for now). Setting the app up opens
 * under its row; its recovery codes are shown once, where they were made.
 */
export function TotpPage() {
  const { t } = useTranslation("authentication");
  return (
    <MethodsArea title={t("methods.mfa.title")} description={t("methods.mfa.description")}>
      <AuthenticatorSections />
    </MethodsArea>
  );
}

function AuthenticatorSections() {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const totp = useTotpStatus();
  const recovery = useRecoveryStatus().data;
  const startApp = useStartTotpEnrollment();
  const disableApp = useDisableTotp();
  const regenerate = useRegenerateRecoveryCodes();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const appOn = totp.data?.enrolled === true;
  // The hooks below are silent, so a failure toasts here; a cancelled step-up already said so.
  const toastUnlessStepUp = (err: unknown) => {
    if (!isStepUpRequired(err)) toastError(err);
  };

  // A confirmed app keeps working until its replacement is confirmed, so replacing is confirmed.
  const setUpApp = (replacing: boolean) =>
    runSensitive({
      confirm: replacing
        ? {
            title: t("totp.replaceConfirmTitle"),
            description: t("totp.replaceConfirmDescription"),
            confirmLabel: t("totp.replace"),
            tone: "default",
          }
        : undefined,
      actionLabel: replacing ? t("totp.replaceTitle") : t("totp.setupTitle"),
      run: () => startApp.mutateAsync(undefined, { onError: toastUnlessStepUp }),
    })
      .then((enrollment) => enrollment && setOpen({ kind: "app", enrollment }))
      .catch(settleSensitiveAction);

  const turnOffApp = () =>
    runSensitive({
      confirm: {
        title: t("totp.turnOffConfirmTitle"),
        description: t("totp.turnOffConfirmDescription"),
        confirmLabel: t("methods.turnOff"),
        tone: "destructive",
      },
      actionLabel: t("totp.turnOffAction"),
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
              title: t("totp.codes.newConfirmTitle"),
              description: t("totp.codes.newConfirmDescription"),
              confirmLabel: t("totp.codes.new"),
              tone: "destructive",
            }
          : undefined,
      actionLabel: t("totp.codes.new"),
      run: () => regenerate.mutateAsync(undefined, { onError: toastUnlessStepUp }),
    })
      .then((res) => {
        if (!res) return;
        toast.success(t("totp.codes.made"));
        setOpen({ kind: "codes", codes: res.recovery_codes });
      })
      .catch(settleSensitiveAction);

  if (totp.isPending) return <Loading rows={2} />;
  if (totp.isError) return <LoadFailed error={totp.error} onRetry={() => void totp.refetch()} />;

  const remaining = recovery?.remaining ?? 0;
  return (
    <>
      <Section
        title={t("totp.title")}
        status={
          <Badge tone={appOn ? "success" : "neutral"} size="sm">
            {appOn ? t("methods.on") : t("methods.off")}
          </Badge>
        }
        description={t("totp.description")}
      >
        <ul className="account-rows">
          {open?.kind === "app" ? (
            <Suspense
              fallback={
                <li className="account-panel">
                  <Loading rows={1} />
                </li>
              }
            >
              <AuthenticatorSetup
                enrollment={open.enrollment}
                onConfirmed={(codes) => setOpen({ kind: "codes", codes })}
                onCancel={close}
              />
            </Suspense>
          ) : (
            <Item
              icon={<QrCodeIcon />}
              name={t("totp.name")}
              line={appOn ? t("totp.lineOn") : t("totp.lineOff")}
              actions={
                appOn ? (
                  <>
                    <Button variant="ghost" onClick={() => void setUpApp(true)}>
                      {t("totp.replace")}
                    </Button>
                    <Button
                      variant="ghost"
                      loading={disableApp.isPending}
                      onClick={() => void turnOffApp()}
                    >
                      {t("methods.turnOff")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    loading={startApp.isPending}
                    onClick={() => void setUpApp(false)}
                  >
                    {t("totp.setUp")}
                  </Button>
                )
              }
            />
          )}
        </ul>
      </Section>

      {(appOn || recovery?.enrolled || open?.kind === "codes") && (
        <Section title={t("totp.codes.title")} description={t("totp.codes.description")}>
          <ul className="account-rows">
            {open?.kind === "codes" ? (
              <RecoveryCodesPanel as="li" codes={open.codes} onDone={close} />
            ) : (
              <Item
                icon={<LifeBuoyIcon />}
                name={t("totp.codes.name")}
                badge={
                  recovery &&
                  recovery.total > 0 &&
                  remaining <= LOW_CODES && (
                    <Badge tone="warning" size="sm">
                      {t("totp.codes.low")}
                    </Badge>
                  )
                }
                line={
                  recovery && recovery.total > 0
                    ? t("totp.codes.line", { remaining, total: recovery.total })
                    : t("totp.codes.lineNone")
                }
                actions={
                  <Button variant="ghost" loading={regenerate.isPending} onClick={newCodes}>
                    {(recovery?.total ?? 0) > 0 ? t("totp.codes.new") : t("totp.codes.make")}
                  </Button>
                }
              />
            )}
          </ul>
        </Section>
      )}
    </>
  );
}
