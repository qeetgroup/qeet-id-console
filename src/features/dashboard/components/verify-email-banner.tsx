import { Button, OTPInput } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, MailWarningIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useConfirmEmailVerification, useMe, useStartEmailVerification } from "@/lib/auth";

/**
 * Sticky banner shown whenever the signed-in user's email is not yet verified.
 * Covers the paths the signup OTP screen misses — social login (lands verified
 * = never, so it shows here) and a user who closed the signup verify step —
 * and it's the nudge that unblocks org creation (the server gates
 * `POST /v1/tenants` on a verified email).
 *
 * Returns null when verified (or while /me is loading), so it's safe to render
 * unconditionally near the top of the layout.
 */
export function VerifyEmailBanner() {
  const meQ = useMe();
  const qc = useQueryClient();
  const start = useStartEmailVerification();
  const confirm = useConfirmEmailVerification();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const me = meQ.data;
  if (!me || me.email_verified_at) return null;

  const resend = () => {
    start.mutate(me.id, {
      onSuccess: () => {
        setOpen(true);
        toast.success("Verification code sent to your email.");
      },
      onError: () => toast.error("Could not send the verification code. Try again."),
    });
  };

  const submit = (value: string) => {
    confirm.mutate(
      { userId: me.id, code: value },
      {
        onSuccess: () => {
          toast.success("Email verified.");
          setOpen(false);
          setCode("");
          void qc.invalidateQueries({ queryKey: ["me"] });
        },
        onError: () => toast.error("That code is incorrect or expired."),
      },
    );
  };

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-center gap-2">
        <MailWarningIcon className="size-4 shrink-0" />
        <span>
          Verify <span className="font-medium">{me.email}</span> to unlock organization creation.
        </span>
      </div>

      {open ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) submit(code);
          }}
        >
          <OTPInput
            value={code}
            onChange={setCode}
            onComplete={submit}
            aria-label="Email verification code"
          />
          <Button type="submit" size="sm" disabled={confirm.isPending || code.length !== 6}>
            {confirm.isPending && <Loader2Icon className="animate-spin" />}
            Verify
          </Button>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={resend} disabled={start.isPending}>
          {start.isPending && <Loader2Icon className="animate-spin" />}
          Send verification code
        </Button>
      )}
    </div>
  );
}
