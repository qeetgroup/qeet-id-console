import {
  ArrowRightIcon,
  FingerprintPatternIcon,
  LockKeyholeIcon,
  MailIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import { Button, Field, Heading, Link, Text, TextField } from "@qeetrix/react";
import { Alert, Form, PasswordInput } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PasskeySignupInput } from "../api/passkey-flows";

import { EntryConsent, EntryOr } from "./entry-shell";
import { ProviderButtons } from "./provider-buttons";

export type SignupFormValues = {
  email: string;
  password: string;
  display_name: string;
};

type SignupFormProps = {
  isLoading?: boolean;
  isPasskeyLoading?: boolean;
  errorMessage?: string;
  /** The email the server says already has an account: offer sign-in instead. */
  existingEmail?: string;
  onSignup?: (values: SignupFormValues) => void;
  onPasskeySignup?: (values: PasskeySignupInput) => void;
};

/**
 * Sign-up, passkey first: a name and a work email, then one touch creates the account and its
 * passkey. A password is the fallback, with no "confirm password" field: its show toggle does that.
 */
export function SignupForm({
  isLoading = false,
  isPasskeyLoading = false,
  errorMessage,
  existingEmail,
  onSignup,
  onPasskeySignup,
}: SignupFormProps) {
  const { t } = useTranslation("auth-flow");
  const [method, setMethod] = useState<"passkey" | "password">("passkey");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const isBusy = isLoading || isPasskeyLoading;
  const isDisabled = !hydrated || isBusy;
  const withPassword = method === "password";

  return (
    <>
      <div className="entry-heading">
        <Heading level={1} size="display-sm">
          {t("signUp.title")}
        </Heading>
        <Text tone="subtle" size="lg">
          {t("signUp.lede")}
        </Text>
      </div>

      {existingEmail ? (
        <Alert
          tone="warning"
          title={t("signUp.emailExistsTitle", { email: existingEmail })}
          actions={<Link render={<RouterLink to="/sign-in" />}>{t("signUp.signInInstead")}</Link>}
        >
          {t("signUp.emailExistsText")}
        </Alert>
      ) : errorMessage ? (
        <Alert tone="danger" title={t("signUp.failedTitle")} announce="urgent">
          {errorMessage}
        </Alert>
      ) : null}

      <Form
        aria-label={t("signUp.title")}
        className="entry-form"
        summary={false}
        aria-busy={isBusy}
        onFormSubmit={(values) => {
          if (isDisabled) return;
          const identity = {
            email: String(values.email ?? "").trim(),
            display_name: String(values.display_name ?? "").trim(),
          };
          if (withPassword) onSignup?.({ ...identity, password: String(values.password ?? "") });
          else onPasskeySignup?.(identity);
        }}
      >
        <TextField
          label={t("signUp.name")}
          name="display_name"
          icon={UserRoundIcon}
          placeholder={t("signUp.namePlaceholder")}
          autoComplete="name"
          required
        />
        <TextField
          label={t("signUp.email")}
          name="email"
          type="email"
          icon={MailIcon}
          placeholder={t("signUp.emailPlaceholder")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          description={t("signUp.emailHelp")}
          invalid={Boolean(existingEmail)}
          required
        />
        {withPassword && (
          <Field label={t("form.password")} name="password" description={t("signUp.passwordHelp")}>
            <PasswordInput autoComplete="new-password" minLength={8} required />
          </Field>
        )}
        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={withPassword ? ArrowRightIcon : FingerprintPatternIcon}
          loading={withPassword ? isLoading : isPasskeyLoading}
          disabled={isDisabled || (!withPassword && !onPasskeySignup)}
        >
          {withPassword
            ? t(isLoading ? "signUp.submitting" : "signUp.submit")
            : t("signUp.submitPasskey")}
        </Button>
      </Form>

      <EntryOr />
      <div className="entry-form">
        <Button
          variant="soft"
          size="lg"
          fullWidth
          icon={withPassword ? FingerprintPatternIcon : LockKeyholeIcon}
          disabled={isDisabled}
          onClick={() => setMethod(withPassword ? "passkey" : "password")}
        >
          {withPassword ? t("signUp.passkeyInstead") : t("signUp.passwordInstead")}
        </Button>
        {!withPassword && <ProviderButtons action="signUp" disabled={isDisabled} />}
      </div>

      <div className="entry-links">
        <span>
          {t("signUp.hasAccount")}{" "}
          <Link render={<RouterLink to="/sign-in" />}>{t("signUp.signIn")}</Link>
        </span>
      </div>
      <EntryConsent action="signUp" />
    </>
  );
}
