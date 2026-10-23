import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldError,
  StatusPill,
} from "@qeetrix/ui";
import {
  FingerprintPatternIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DataState } from "@/platform/components/data-state";
import { ErrorText } from "@/platform/components/error-reference";
import { PageHeader } from "@/platform/components/page-header";
import { toastError } from "@/platform/errors/error-toast";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { isStepUpRequired } from "@/platform/security/step-up";
import {
  type TotpEnrollment,
  useConfirmTotpEnrollment,
  useDisableTotp,
  useRecoveryStatus,
  useRegenerateRecoveryCodes,
  useStartTotpEnrollment,
  useTotpStatus,
} from "../api/mfa";
import { RecoveryCodeList } from "./recovery-code-list";
import { TotpEnrollmentCard } from "./totp-enrollment-card";

const DEFAULT_RECOVERY_CODES = 10;
const LOW_RECOVERY_CODES = 3;

/**
 * Renders the signed-in person's authenticator app: set it up, replace or disable it, and manage
 * the recovery codes that back it. The codes from a confirmation are shown once, here.
 */
export function TotpPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const statusQ = useTotpStatus();
  const startM = useStartTotpEnrollment();
  const confirmM = useConfirmTotpEnrollment();
  const disableM = useDisableTotp();
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Setting up an app can need a step-up, which the shared dialog asks for; replacing a confirmed
  // one is confirmed first. A failure shows on the card.
  function startEnrollment(replacing: boolean) {
    runSensitive({
      confirm: replacing
        ? {
            title: t("mfa.totp.active.replaceConfirmTitle"),
            description: t("mfa.totp.active.replaceConfirmDescription"),
            confirmLabel: t("mfa.totp.active.replaceConfirmLabel"),
            tone: "destructive",
          }
        : undefined,
      actionLabel: replacing
        ? t("mfa.totp.active.replaceStepUpLabel")
        : t("mfa.totp.idle.stepUpLabel"),
      run: () => startM.mutateAsync(),
    })
      .then((res) => res && setEnrollment(res))
      .catch(settleSensitiveAction);
  }

  function confirm(code: string) {
    confirmM.mutate(code, {
      onSuccess: (res) => {
        setEnrollment(null);
        setRecoveryCodes(res.recovery_codes);
      },
    });
  }

  function disable() {
    runSensitive({
      confirm: {
        title: t("mfa.totp.confirmed.disableConfirmTitle"),
        description: t("mfa.totp.confirmed.disableConfirmDescription"),
        confirmLabel: t("mfa.totp.confirmed.disableConfirmLabel"),
        tone: "destructive",
      },
      actionLabel: t("mfa.totp.stepUpLabel"),
      run: () => disableM.mutateAsync(),
    })
      .then(() => setRecoveryCodes(null))
      .catch(settleSensitiveAction);
  }

  const disableButton = (label: string) => (
    <Button variant="outline" onClick={disable} disabled={disableM.isPending}>
      {disableM.isPending && <LoaderCircleIcon className="animate-spin" />}
      {label}
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("mfa.totp.description")} />

      {enrollment ? (
        <TotpEnrollmentCard
          enrollment={enrollment}
          error={confirmM.error}
          isConfirming={confirmM.isPending}
          onConfirm={confirm}
          onCancel={() => {
            setEnrollment(null);
            confirmM.reset();
          }}
        />
      ) : recoveryCodes ? (
        <>
          <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t("mfa.totp.confirmed.title")}{" "}
                    <Badge variant="success" className="ml-2">
                      {t("mfa.totp.confirmed.activeBadge")}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{t("mfa.totp.confirmed.subtitle")}</CardDescription>
                </div>
                <ShieldCheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
          </Card>
          <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="text-base">{t("mfa.totp.confirmed.recoveryTitle")}</CardTitle>
              <CardDescription>{t("mfa.totp.confirmed.recoveryDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RecoveryCodeList
                codes={recoveryCodes}
                copyLabel={t("mfa.totp.confirmed.copyAllBtn")}
                copiedLabel={t("mfa.totp.recovery.copiedBtn")}
                downloadLabel={t("mfa.totp.confirmed.downloadBtn")}
              />
              <div className="flex gap-2">
                <Button onClick={() => setRecoveryCodes(null)}>
                  {t("mfa.totp.confirmed.doneBtn")}
                </Button>
                {disableButton(t("mfa.totp.confirmed.disableBtn"))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <DataState
          isLoading={statusQ.isLoading}
          isError={statusQ.isError}
          error={statusQ.error}
          isEmpty={false}
          skeletonRows={2}
        >
          {statusQ.data?.enrolled ? (
            // Recovery codes are managed here because they only back this factor and go with it.
            <>
              <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {t("mfa.totp.active.title")}{" "}
                        <Badge variant="success" className="ml-2">
                          {t("mfa.totp.active.activeBadge")}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{t("mfa.totp.active.subtitle")}</CardDescription>
                    </div>
                    <ShieldCheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t("mfa.totp.active.manageHint")}</p>
                  <StartError error={startM.error} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => startEnrollment(true)}
                      disabled={startM.isPending}
                    >
                      {startM.isPending && <LoaderCircleIcon className="animate-spin" />}
                      <FingerprintPatternIcon /> {t("mfa.totp.active.replaceBtn")}
                    </Button>
                    {disableButton(t("mfa.totp.active.disableBtn"))}
                  </div>
                </CardContent>
              </Card>
              <RecoveryCodesCard />
            </>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t("mfa.totp.idle.title")}</CardTitle>
                    <CardDescription>{t("mfa.totp.idle.subtitle")}</CardDescription>
                  </div>
                  <FingerprintPatternIcon className="size-6 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>{t("mfa.totp.idle.bullet1")}</li>
                  <li>{t("mfa.totp.idle.bullet2")}</li>
                  <li>{t("mfa.totp.idle.bullet3")}</li>
                </ul>
                <StartError error={startM.error} />
                <Button onClick={() => startEnrollment(false)} disabled={startM.isPending}>
                  {startM.isPending && <LoaderCircleIcon className="animate-spin" />}
                  {startM.isPending
                    ? t("mfa.totp.idle.generatingBtn")
                    : t("mfa.totp.idle.beginBtn")}
                </Button>
              </CardContent>
            </Card>
          )}
        </DataState>
      )}
    </div>
  );
}

function StartError({ error }: { error: unknown }) {
  if (error == null || isStepUpRequired(error)) return null;
  return (
    <FieldError>
      <ErrorText error={error} />
    </FieldError>
  );
}

/** Renders how many recovery codes remain, and regenerates them, showing the new set once. */
function RecoveryCodesCard() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const recoveryQ = useRecoveryStatus();
  const regenM = useRegenerateRecoveryCodes();
  const remaining = recoveryQ.data?.remaining ?? 0;
  const hasCodes = (recoveryQ.data?.total ?? 0) > 0;
  const fresh = regenM.data?.recovery_codes ?? [];

  // Only regenerating is confirmed: it voids the codes the person already holds.
  function regenerate() {
    runSensitive({
      confirm: hasCodes
        ? {
            title: t("mfa.totp.recovery.regenerateConfirmTitle"),
            description: t("mfa.totp.recovery.regenerateConfirmDescription"),
            confirmLabel: t("mfa.totp.recovery.regenerateConfirmLabel"),
            tone: "destructive",
          }
        : undefined,
      actionLabel: t("mfa.totp.recovery.stepUpLabel"),
      // The hook is silent, so this page reports a failure; a cancelled step-up already said so.
      run: () =>
        regenM.mutateAsync(undefined, {
          onError: (err) => {
            if (!isStepUpRequired(err)) toastError(err);
          },
        }),
    })
      .then(() => toast.success(t("mfa.totp.recovery.toastSuccess")))
      .catch(settleSensitiveAction);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t("mfa.totp.recovery.title")}</CardTitle>
            <CardDescription>{t("mfa.totp.recovery.description")}</CardDescription>
          </div>
          <KeyRoundIcon className="size-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recoveryQ.data && (
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold tracking-tight">
              {remaining}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {recoveryQ.data.total || DEFAULT_RECOVERY_CODES}
              </span>
            </div>
            <StatusPill kind={remaining <= LOW_RECOVERY_CODES ? "warning" : "success"}>
              {remaining <= LOW_RECOVERY_CODES
                ? t("mfa.totp.recovery.low")
                : t("mfa.totp.recovery.healthy")}
            </StatusPill>
          </div>
        )}
        {fresh.length > 0 && (
          <div className="space-y-3 rounded-md border border-primary p-4">
            <p className="text-sm text-muted-foreground">
              {t("mfa.totp.recovery.freshDescription")}
            </p>
            <RecoveryCodeList
              codes={fresh}
              copyLabel={t("mfa.totp.recovery.copyAllBtn")}
              copiedLabel={t("mfa.totp.recovery.copiedBtn")}
              downloadLabel={t("mfa.totp.recovery.downloadBtn")}
            />
          </div>
        )}
        <Button size="sm" variant="outline" onClick={regenerate} disabled={regenM.isPending}>
          <RefreshCwIcon className={regenM.isPending ? "animate-spin" : ""} />
          {hasCodes ? t("mfa.totp.recovery.regenerateBtn") : t("mfa.totp.recovery.generateBtn")}
        </Button>
      </CardContent>
    </Card>
  );
}
