import { Button, cn, Field, FieldError, FieldLabel, Input, PasswordInput } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, BuildingIcon, Loader2Icon, LockKeyholeIcon, MailIcon } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSSODiscovery } from "../api/sso";

import { AuthDivider, AuthFormCard, PasskeyButton } from "./auth-form-card";
import { BrandHero } from "./brand-hero";
import { SocialButtons } from "./social-buttons";

export type LoginFormValues = {
  email: string;
  password: string;
};

type LoginFormProps = React.ComponentProps<"div"> & {
  isLoading?: boolean;
  isPasskeyLoading?: boolean;
  errorMessage?: string;
  onLogin?: (values: LoginFormValues) => void;
  onPasskeyLogin?: () => void;
};

export function LoginForm({
  className,
  isLoading = false,
  isPasskeyLoading = false,
  errorMessage,
  onLogin,
  onPasskeyLogin,
  ...props
}: LoginFormProps) {
  const { t } = useTranslation("auth-flow");
  const [email, setEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  // Debounce the email value used to drive SSO discovery so we don't
  // hammer the discovery endpoint on every keystroke.
  const [debouncedEmail, setDebouncedEmail] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedEmail(email), 350);
    return () => clearTimeout(t);
  }, [email]);

  const sso = useSSODiscovery(debouncedEmail);
  const ssoHit = sso.data;
  const isBusy = isLoading || isPasskeyLoading;

  return (
    <div className={cn("auth-entry auth-entry-signin", className)} {...props}>
      <BrandHero />
      <AuthFormCard>
        <form
          method="post"
          aria-labelledby="signin-title"
          aria-busy={isBusy}
          onSubmit={(e) => {
            e.preventDefault();
            if (!hydrated || isBusy) return;
            if (ssoHit) {
              // Browser redirect to the IdP — leaves the SPA entirely.
              window.location.href = ssoHit.redirect_url;
              return;
            }
            const data = new FormData(e.currentTarget);
            onLogin?.({
              email: String(data.get("email") ?? "").trim(),
              password: String(data.get("password") ?? ""),
            });
          }}
        >
          <div className="auth-form-header">
            <p className="auth-form-eyebrow">{t("signIn.eyebrow")}</p>
            <h1 id="signin-title" className="auth-form-title">
              {t("signIn.title")}
            </h1>
            <p className="auth-form-description">{t("signIn.description")}</p>
          </div>

          <div className="auth-fields">
            <Field className="auth-field" disabled={isBusy}>
              <FieldLabel htmlFor="email">{t("form.email")}</FieldLabel>
              <div className="auth-input-wrap">
                <MailIcon className="auth-input-icon" aria-hidden="true" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username webauthn"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t("form.emailPlaceholder")}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </Field>

            {ssoHit ? (
              <div className="auth-sso-notice" role="status">
                <BuildingIcon className="size-4" aria-hidden="true" />
                <div>
                  <p className="font-medium">{ssoHit.provider_name}</p>
                  <p>{t("form.ssoDescription", { kind: ssoHit.kind.toUpperCase() })}</p>
                </div>
              </div>
            ) : (
              <Field className="auth-field" disabled={isBusy}>
                <div className="auth-field-row">
                  <FieldLabel htmlFor="password">{t("form.password")}</FieldLabel>
                  <Link to="/forgot-password" className="auth-link">
                    {t("form.forgotPassword")}
                  </Link>
                </div>
                <div className="auth-input-wrap">
                  <LockKeyholeIcon className="auth-input-icon" aria-hidden="true" />
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder={t("form.passwordPlaceholder")}
                    required
                  />
                </div>
              </Field>
            )}
          </div>

          {errorMessage && <FieldError className="auth-form-error">{errorMessage}</FieldError>}

          <Button type="submit" className="auth-submit" disabled={!hydrated || isBusy}>
            {isLoading && <Loader2Icon className="animate-spin" aria-hidden="true" />}
            {ssoHit
              ? t("form.ssoContinue", { provider: ssoHit.provider_name })
              : t(isLoading ? "signIn.submitting" : "signIn.submit")}
            {!isLoading && <ArrowRightIcon aria-hidden="true" />}
          </Button>

          {!ssoHit && (
            <>
              <AuthDivider>{t("passkey.signinDivider")}</AuthDivider>
              <PasskeyButton
                isLoading={isPasskeyLoading}
                disabled={!hydrated || isBusy || !onPasskeyLogin}
                onClick={onPasskeyLogin}
              />
            </>
          )}

          <SocialButtons verb={t("signIn.submit")} disabled={!hydrated || isBusy} />

          <p className="auth-form-switch">
            {t("signIn.noAccount")}{" "}
            <Link to="/sign-up" className="auth-link">
              {t("signIn.signupLink")}
            </Link>
          </p>
        </form>
      </AuthFormCard>
    </div>
  );
}
