import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  PasswordInput,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandHero } from "@/features/auth/components/brand-hero";
import { useForgotPassword, useResetPassword } from "@/lib/auth";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

// The page has two modes on one route: no ?token= → request a reset link; with
// ?token= → set a new password. This keeps the whole flow in the console (no
// hosted-login app) and avoids adding a second route.
function ForgotPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            {token ? <ResetPanel token={token} /> : <RequestPanel />}
          </div>
          <BrandHero />
        </CardContent>
      </Card>
    </div>
  );
}

function RequestPanel() {
  const { t } = useTranslation("authFlow");
  const forgot = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (submitted) {
    return <SuccessPanel devToken={forgot.data?.dev_reset_token} />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const email = String(data.get("email") ?? "").trim();
        if (!email) return;
        // Always show success — the endpoint is constant-time so a 4xx must not
        // leak whether the email exists.
        forgot.mutate({ email }, { onSettled: () => setSubmitted(true) });
      }}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">{t("forgotPassword.title")}</h1>
          <p className="text-balance text-muted-foreground">{t("forgotPassword.subtitle")}</p>
        </div>

        <Field>
          <FieldLabel htmlFor="email">{t("forgotPassword.emailLabel")}</FieldLabel>
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
        </Field>

        <Field>
          <Button type="submit" disabled={forgot.isPending}>
            {forgot.isPending && <Loader2Icon className="animate-spin" />}
            {forgot.isPending ? t("forgotPassword.sendingBtn") : t("forgotPassword.sendBtn")}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          {t("forgotPassword.rememberedIt")}{" "}
          <Link to="/sign-in" className="underline-offset-2 hover:underline">
            {t("forgotPassword.backToSignIn")}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

function ResetPanel({ token }: { token: string }) {
  const { t } = useTranslation("authFlow");
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password !== confirm) {
          setMismatch(true);
          return;
        }
        setMismatch(false);
        reset.mutate({ token, new_password: password });
      }}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">{t("forgotPassword.reset.title")}</h1>
          <p className="text-balance text-muted-foreground">
            {t("forgotPassword.reset.subtitle")}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="new-password">{t("forgotPassword.reset.passwordLabel")}</FieldLabel>
          <PasswordInput
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">
            {t("forgotPassword.reset.confirmLabel")}
          </FieldLabel>
          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        {mismatch && (
          <Field>
            <FieldError>{t("forgotPassword.reset.mismatch")}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending && <Loader2Icon className="animate-spin" />}
            {reset.isPending
              ? t("forgotPassword.reset.submittingBtn")
              : t("forgotPassword.reset.submitBtn")}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          {t("forgotPassword.rememberedIt")}{" "}
          <Link to="/sign-in" className="underline-offset-2 hover:underline">
            {t("forgotPassword.backToSignIn")}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

function SuccessPanel({ devToken }: { devToken?: string }) {
  const { t } = useTranslation("authFlow");
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <CheckCircle2Icon className="size-10 text-emerald-500" />
      <h1 className="text-2xl font-bold">{t("forgotPassword.successTitle")}</h1>
      <p className="text-balance text-muted-foreground">{t("forgotPassword.successText")}</p>

      {/* Dev only: the backend hands back the token so the reset link works
          without a real email provider. */}
      {devToken && (
        <div className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-left dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("forgotPassword.devLinkTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t("forgotPassword.devLinkText")}</p>
          <a
            href={`/forgot-password?token=${encodeURIComponent(devToken)}`}
            className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-2 w-full`}
          >
            {t("forgotPassword.devLinkButton")}
          </a>
        </div>
      )}

      <p className="mt-2 text-sm text-muted-foreground">
        {t("forgotPassword.successResend")}{" "}
        <Link to="/forgot-password" className="underline-offset-2 hover:underline">
          {t("forgotPassword.successResendLink")}
        </Link>
        .
      </p>
      <Link to="/sign-in" className={`${buttonVariants({ variant: "outline" })} mt-4`}>
        {t("forgotPassword.successBackBtn")}
      </Link>
    </div>
  );
}
