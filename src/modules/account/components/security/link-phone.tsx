import { RefreshCwIcon } from "@qeetrix/icons";
import { Button, Spinner } from "@qeetrix/react";
import { QRCode } from "@qeetrix/react/experimental";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  authKeys,
  isStepUpRequired,
  type PushPairing,
  pairingLink,
  usePairingStatus,
  useStartPairing,
  useWithdrawPairing,
} from "@/modules/authentication";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Panel } from "../account-parts";

// "4:05": minutes and seconds left.
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Linking a phone running Qeet Auth with a one-time pairing code, shown as a QR code beside the
 * code as text (the sign-in setup's `.entry-qr` card); asking for it needs a step-up. Watches the
 * code until the phone links, offers a new one once it expires, and withdraws an unused code when
 * closed so nobody can scan it later. Its own module, loaded when linking starts.
 */
export default function LinkPhone({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("account");
  const qc = useQueryClient();
  const runSensitive = useSensitiveAction();
  const start = useStartPairing();
  const withdraw = useWithdrawPairing();
  const [pairing, setPairing] = useState<(PushPairing & { code: string }) | null>(null);
  const status = usePairingStatus(pairing?.id ?? null);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const asked = useRef(false); // asks once, though development mounts effects twice

  function ask() {
    setPairing(null);
    runSensitive({
      actionLabel: t("security.phone.action"),
      run: () =>
        start.mutateAsync(undefined, {
          // A cancelled step-up: the provider has said nothing was changed.
          onError: (err) => {
            if (isStepUpRequired(err)) onClose();
          },
        }),
    })
      .then((issued) => {
        if (!issued) return;
        if (!mounted.current) return withdraw.mutate(issued.id);
        setNow(Date.now());
        setPairing(issued);
      })
      .catch(settleSensitiveAction);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: asks on opening only
  useEffect(() => {
    mounted.current = true;
    if (!asked.current) {
      asked.current = true;
      ask();
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  const secondsLeft = pairing
    ? Math.max(0, Math.ceil((Date.parse(pairing.expires_at) - now) / 1000))
    : 0;
  const state = status.data?.status ?? (pairing ? "pending" : undefined);
  const expired = state === "expired" || (state === "pending" && secondsLeft === 0);
  const live = state === "pending" && !expired;

  // Counts down while the code can still be used.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  // The phone scanned it: done, once.
  const finished = useRef(false);
  useEffect(() => {
    if (state !== "linked" || finished.current) return;
    finished.current = true;
    void qc.invalidateQueries({ queryKey: authKeys.pushDevices() });
    toast.success(t("security.phone.linked"));
    onClose();
  }, [state, qc, t, onClose]);

  // Closed, or left, with a code still usable: withdraw it.
  const pending = useRef<string | null>(null);
  pending.current = live && pairing ? pairing.id : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: on leaving only
  useEffect(
    () => () => {
      if (pending.current) withdraw.mutate(pending.current);
    },
    [],
  );

  const failure = start.error && !isStepUpRequired(start.error) ? start.error : null;

  return (
    <Panel as="li" title={t("security.phone.title")} description={t("security.phone.description")}>
      {failure ? (
        <p role="alert" className="account-note">
          {errorMessage(failure)}
        </p>
      ) : !pairing ? (
        <div className="entry-qr" aria-busy="true">
          <div className="entry-qr-placeholder" />
          <div className="entry-qr-key">
            <Spinner size="sm" label={t("security.phone.preparing")} />
          </div>
        </div>
      ) : (
        <div className="entry-qr">
          {expired ? (
            <div className="entry-qr-placeholder" />
          ) : (
            <QRCode
              value={pairingLink(pairing.code)}
              label={t("security.phone.qrLabel")}
              size={152}
            />
          )}
          <div className="entry-qr-key" aria-live="polite">
            {expired ? (
              t("security.phone.expired")
            ) : (
              <>
                {t("security.phone.orType")}
                <code>{pairing.code}</code>
                {t("security.phone.expiresIn", { time: clock(secondsLeft) })}
              </>
            )}
          </div>
        </div>
      )}
      <span className="account-panel-actions">
        {(expired || failure) && (
          <Button size="lg" icon={RefreshCwIcon} loading={start.isPending} onClick={ask}>
            {t("security.phone.newCode")}
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={onClose}>
          {t("cancel")}
        </Button>
      </span>
    </Panel>
  );
}
