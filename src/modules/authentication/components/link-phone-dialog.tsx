import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  QRCode,
  Spinner,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { errorMessage } from "@/platform/errors/user-message";
import { isStepUpRequired } from "@/platform/security/step-up";
import {
  type PushPairing,
  pairingLink,
  usePairingStatus,
  useStartPairing,
  useWithdrawPairing,
} from "../api/push-devices";

// "4:05" — minutes and seconds left.
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Links a phone running Qeet Auth to the caller's account with a one-time pairing code, shown as a
 * QR code and as text; requesting it needs a step-up. Watches the code until the phone links,
 * offers a new one on expiry, and withdraws an unused code on close so nobody can scan it later.
 */
export function LinkPhoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("account");
  const qc = useQueryClient();
  const start = useStartPairing();
  const withdraw = useWithdrawPairing();
  const [pairing, setPairing] = useState<(PushPairing & { code: string }) | null>(null);
  const status = usePairingStatus(pairing?.id ?? null);
  const [now, setNow] = useState(() => Date.now());
  const openRef = useRef(open); // Whether the dialog is still open when a code arrives
  openRef.current = open;

  function ask() {
    setPairing(null);
    start.mutate(undefined, {
      onSuccess: (p) => {
        if (openRef.current) {
          setNow(Date.now());
          setPairing(p);
        } else {
          withdraw.mutate(p.id);
        }
      },
      onError: (err) => {
        // A cancelled step-up: the provider has said nothing was changed.
        if (isStepUpRequired(err)) onOpenChange(false);
      },
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on opening only
  useEffect(() => {
    if (open) ask();
  }, [open]);

  const secondsLeft = pairing
    ? Math.max(0, Math.ceil((Date.parse(pairing.expires_at) - now) / 1000))
    : 0;
  const state = status.data?.status ?? (pairing ? "pending" : undefined);
  const expired = state === "expired" || (state === "pending" && secondsLeft === 0);

  const live = state === "pending" && !expired; // Count down while the code can still be used
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  // The phone scanned it: done.
  useEffect(() => {
    if (state !== "linked") return;
    void qc.invalidateQueries({ queryKey: ["push-devices", "self"] });
    toast.success(t("security.phones.dialog.linked"));
    setPairing(null);
    onOpenChange(false);
  }, [state, qc, t, onOpenChange]);

  function close(next: boolean) {
    if (!next && pairing && state === "pending") withdraw.mutate(pairing.id);
    if (!next) {
      setPairing(null);
      start.reset();
    }
    onOpenChange(next);
  }

  const failure = start.error && !isStepUpRequired(start.error) ? start.error : null;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("security.phones.dialog.title")}</DialogTitle>
          <DialogDescription>{t("security.phones.dialog.description")}</DialogDescription>
        </DialogHeader>

        {start.isPending && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(failure)}
          </p>
        )}

        {pairing && !expired && (
          <div className="flex flex-col items-center gap-3">
            <QRCode value={pairingLink(pairing.code)} size={200} aria-labelledby="pair-scan" />
            <p id="pair-scan" className="text-sm text-muted-foreground">
              {t("security.phones.dialog.scan")}
            </p>
            <p className="text-sm text-muted-foreground">{t("security.phones.dialog.orType")}</p>
            <p className="font-mono text-lg tracking-widest" data-testid="pairing-code">
              {pairing.code}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("security.phones.dialog.expiresIn", { time: clock(secondsLeft) })}
            </p>
          </div>
        )}

        {pairing && expired && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("security.phones.dialog.expired")}
          </p>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {t("security.phones.dialog.close")}
          </Button>
          {((pairing && expired) || failure) && (
            <Button onClick={ask} disabled={start.isPending}>
              {t("security.phones.dialog.newCode")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
