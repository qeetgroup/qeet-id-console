import {
  Button,
  buttonVariants,
  cn,
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

import { AuthFormCard } from "@/modules/authentication/components/auth-form-card";
import { BrandHero } from "@/modules/authentication/components/brand-hero";
import { useForgotPassword, useResetPassword } from "@/modules/authentication";

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

  // Same shell as /sign-in and /sign-up: `auth-entry` is the two-column grid
  // that sizes the hero against a fixed-width card. This route previously
  // hand-rolled a Card with `md:grid-cols-2`, which split the space evenly and
  // left the form a different width and offset from every other auth page.
  return (
    <div className="auth-entry">
      <BrandHero />
      <AuthFormCard>{token ? <ResetPanel token={token} /> : <RequestPanel />}</AuthFormCard>
    </div>
  );
}

function RequestPanel() {
  const { t } = useTranslation("auth-flow");
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
        <div className="auth-form-header">
          <h1 className="auth-form-title">{t("forgotPassword.title")}</h1>
          <p className="auth-form-description">{t("forgotPassword.subtitle")}</p>
        </div>

        <Field className="auth-field">
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
          <Button type="submit" className="auth-submit" disabled={forgot.isPending}>
            {forgot.isPending && <Loader2Icon className="animate-spin" />}
            {forgot.isPending ? t("forgotPassword.sendingBtn") : t("forgotPassword.sendBtn")}
          </Button>
        </Field>

        <FieldDescription className="auth-form-switch">
          {t("forgotPassword.rememberedIt")}{" "}
          <Link to="/sign-in" className="auth-link">
            {t("forgotPassword.backToSignIn")}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

function ResetPanel({ token }: { token: string }) {
  const { t } = useTranslation("auth-flow");
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
        <div className="auth-form-header">
          <h1 className="auth-form-title">{t("forgotPassword.reset.title")}</h1>
          <p className="auth-form-description">{t("forgotPassword.reset.subtitle")}</p>
        </div>

        <Field className="auth-field">
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

        <Field className="auth-field">
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
          <Button type="submit" className="auth-submit" disabled={reset.isPending}>
            {reset.isPending && <Loader2Icon className="animate-spin" />}
            {reset.isPending
              ? t("forgotPassword.reset.submittingBtn")
              : t("forgotPassword.reset.submitBtn")}
          </Button>
        </Field>

        <FieldDescription className="auth-form-switch">
          {t("forgotPassword.rememberedIt")}{" "}
          <Link to="/sign-in" className="auth-link">
            {t("forgotPassword.backToSignIn")}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}

function SuccessPanel({ devToken }: { devToken?: string }) {
  const { t } = useTranslation("auth-flow");
  return (
    <div className="flex flex-col gap-4">
      <div className="auth-form-header">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2Icon className="size-6" />
        </span>
        <h1 className="auth-form-title mt-3">{t("forgotPassword.successTitle")}</h1>
        <p className="auth-form-description">{t("forgotPassword.successText")}</p>
      </div>

      {/* Dev only: the backend hands back the token so the reset link works
          without a real email provider. */}
      {devToken ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-start">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("forgotPassword.devLinkTitle")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("forgotPassword.devLinkText")}
          </p>
          <a
            href={`/forgot-password?token=${encodeURIComponent(devToken)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}
          >
            {t("forgotPassword.devLinkButton")}
          </a>
        </div>
      ) : null}

      <Link to="/sign-in" className={cn(buttonVariants({ variant: "outline" }), "auth-submit")}>
        {t("forgotPassword.successBackBtn")}
      </Link>

      <p className="auth-form-switch">
        {t("forgotPassword.successResend")}{" "}
        <Link to="/forgot-password" className="auth-link">
          {t("forgotPassword.successResendLink")}
        </Link>
        .
      </p>
    </div>
  );
}
