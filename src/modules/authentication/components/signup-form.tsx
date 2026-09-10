import {
  Button,
  cn,
  Field,
  FieldError,
  FieldLabel,
  Input,
  PasswordInput,
  PasswordStrengthMeter,
  scorePassword,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PasskeySignupInput } from "../api/passkey-flows";

import { AuthDivider, AuthFormCard, PasskeyButton } from "./auth-form-card";
import { BrandHero } from "./brand-hero";
import { SocialButtons } from "./social-buttons";

export type SignupFormValues = {
  email: string;
  password: string;
  display_name: string;
};

type SignupFormProps = React.ComponentProps<"div"> & {
  isLoading?: boolean;
  isPasskeyLoading?: boolean;
  errorMessage?: string;
  onSignup?: (values: SignupFormValues) => void;
  onPasskeySignup?: (values: PasskeySignupInput) => void;
};

export function SignupForm({
  className,
  isLoading = false,
  isPasskeyLoading = false,
  errorMessage,
  onSignup,
  onPasskeySignup,
  ...props
}: SignupFormProps) {
  const { t } = useTranslation("auth-flow");
  const [mismatch, setMismatch] = useState(false);
  const [password, setPassword] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const passwordScore = scorePassword(password);
  const passwordFeedback = passwordScore < 3 ? [t("signUp.passwordFeedback")] : undefined;
  const isBusy = isLoading || isPasskeyLoading;
  const isDisabled = !hydrated || isBusy;

  return (
    <div className={cn("auth-entry auth-entry-signup", className)} {...props}>
      <BrandHero intent="signup" />
      <AuthFormCard>
        <form
          method="post"
          aria-labelledby="signup-title"
          aria-busy={isBusy}
          onSubmit={(e) => {
            e.preventDefault();
            if (!hydrated || isBusy) return;
            const data = new FormData(e.currentTarget);
            const identity = {
              email: String(data.get("email") ?? "").trim(),
              display_name: String(data.get("display_name") ?? "").trim(),
            };
            const submitter = (e.nativeEvent as SubmitEvent).submitter;
            if (submitter?.getAttribute("data-auth-method") === "passkey") {
              // Passkey signup requires identity fields, not a password. Validate
              // only those fields; formNoValidate does not skip this validation.
              if (!nameRef.current?.reportValidity() || !emailRef.current?.reportValidity()) {
                return;
              }
              setMismatch(false);
              onPasskeySignup?.(identity);
              return;
            }
            const password = String(data.get("password") ?? "");
            const confirm = String(data.get("confirm_password") ?? "");
            if (password !== confirm) {
              setMismatch(true);
              confirmRef.current?.focus();
              return;
            }
            setMismatch(false);
            onSignup?.({ ...identity, password });
          }}
        >
          <div className="auth-form-header">
            <p className="auth-form-eyebrow">
              <span className="auth-copy-light">{t("signUp.eyebrowLight")}</span>
              <span className="auth-copy-dark">{t("signUp.eyebrowDark")}</span>
            </p>
            <h1 id="signup-title" className="auth-form-title">
              <span className="auth-copy-light">{t("signUp.titleLight")}</span>
              <span className="auth-copy-dark">{t("signUp.titleDark")}</span>
            </h1>
            <p className="auth-form-description">
              <span className="auth-copy-light">{t("signUp.descriptionLight")}</span>
              <span className="auth-copy-dark">{t("signUp.descriptionDark")}</span>
            </p>
          </div>

          <div className="auth-fields">
            <Field className="auth-field" disabled={isBusy}>
              <FieldLabel htmlFor="display_name">{t("signUp.name")}</FieldLabel>
              <div className="auth-input-wrap">
                <UserRound className="auth-input-icon auth-copy-dark" aria-hidden="true" />
                <Input
                  ref={nameRef}
                  id="display_name"
                  name="display_name"
                  type="text"
                  autoComplete="name"
                  placeholder={t("signUp.namePlaceholder")}
                  required
                />
              </div>
            </Field>

            <Field className="auth-field" disabled={isBusy}>
              <FieldLabel htmlFor="email">{t("signUp.email")}</FieldLabel>
              <div className="auth-input-wrap">
                <Mail className="auth-input-icon auth-copy-dark" aria-hidden="true" />
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t("signUp.emailPlaceholder")}
                  required
                  aria-describedby="signup-email-help"
                />
              </div>
              <p id="signup-email-help" className="auth-field-help auth-copy-dark">
                {t("signUp.emailHelp")}
              </p>
            </Field>

            <Field className="auth-field" disabled={isBusy}>
              <FieldLabel htmlFor="password">{t("form.password")}</FieldLabel>
              <div className="auth-input-wrap">
                <LockKeyhole className="auth-input-icon auth-copy-dark" aria-hidden="true" />
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder={t("signUp.passwordPlaceholder")}
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMismatch(false);
                  }}
                  aria-describedby={password.length > 0 ? "password-strength" : undefined}
                />
              </div>
            </Field>

            <Field className="auth-field" disabled={isBusy} data-invalid={mismatch || undefined}>
              <FieldLabel htmlFor="confirm_password">{t("signUp.confirmPassword")}</FieldLabel>
              <div className="auth-input-wrap">
                <LockKeyhole className="auth-input-icon auth-copy-dark" aria-hidden="true" />
                <PasswordInput
                  ref={confirmRef}
                  id="confirm_password"
                  name="confirm_password"
                  autoComplete="new-password"
                  placeholder={t("signUp.confirmPlaceholder")}
                  minLength={8}
                  required
                  aria-invalid={mismatch || undefined}
                  aria-describedby={mismatch ? "password-mismatch" : undefined}
                  onChange={() => setMismatch(false)}
                />
              </div>
              {mismatch && <FieldError id="password-mismatch">{t("signUp.mismatch")}</FieldError>}
            </Field>
          </div>

          {password.length > 0 && (
            <div id="password-strength" className="auth-password-strength">
              <PasswordStrengthMeter value={password} feedback={passwordFeedback} />
            </div>
          )}

          {errorMessage && !mismatch && (
            <FieldError className="auth-form-error">{errorMessage}</FieldError>
          )}

          <Button type="submit" className="auth-submit" disabled={isDisabled}>
            {isLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t(isLoading ? "signUp.submitting" : "signUp.submit")}
            {!isLoading && <ArrowRight aria-hidden="true" />}
          </Button>

          <AuthDivider>{t("passkey.signupDivider")}</AuthDivider>
          <PasskeyButton
            type="submit"
            formNoValidate
            data-auth-method="passkey"
            isLoading={isPasskeyLoading}
            disabled={isDisabled || !onPasskeySignup}
          />

          <SocialButtons verb={t("signIn.signupLink")} intent="signup" disabled={isDisabled} />

          <p className="auth-form-switch">
            {t("signUp.hasAccount")}{" "}
            <Link to="/sign-in" className="auth-link">
              {t("signIn.submit")}
            </Link>
          </p>
        </form>
      </AuthFormCard>
    </div>
  );
}
