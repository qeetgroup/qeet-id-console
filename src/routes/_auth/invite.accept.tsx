import {
  Button,
  buttonVariants,
  cn,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  PasswordInput,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAcceptInvite, useInvitePreview } from "@/modules/authentication";
import {
  passkeyErrorMessage,
  useAcceptInviteWithPasskey,
} from "@/modules/authentication/api/passkey-flows";
import {
  AuthDivider,
  AuthFormCard,
  PasskeyButton,
} from "@/modules/authentication/components/auth-form-card";
import { BrandHero } from "@/modules/authentication/components/brand-hero";
import { ApiError } from "@/platform/api/client";
import { errorMessage } from "@/platform/errors/user-message";

export const Route = createFileRoute("/_auth/invite/accept")({
  component: AcceptInvitePage,
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

/** A card with a title, a line of text and a way back to sign-in. */
function InviteNotice({ title, description }: { title: string; description?: string }) {
  const { t } = useTranslation("auth-flow");
  return (
    <div className="auth-entry">
      <BrandHero />
      <AuthFormCard>
        <div className="auth-form-header">
          <h1 className="auth-form-title">{title}</h1>
          {description && <p className="auth-form-description">{description}</p>}
        </div>
        <Link
          to="/sign-in"
          className={cn(buttonVariants({ variant: "outline" }), "auth-submit mt-4")}
        >
          {t("invite.backToSignIn")}
        </Link>
      </AuthFormCard>
    </div>
  );
}

/**
 * Accepting an invite is a sign-up, so it uses the same shell as /sign-up:
 * `auth-entry` (hero + fixed-width card) rather than a bare <Card>, which
 * rendered as a narrow panel floating at a different width and offset from
 * every other auth route.
 *
 * The invitation is looked up first: it names the organisation and address,
 * says whether an account already holds the address, and which ways of
 * accepting the organisation allows — a password always, a passkey where the
 * organisation allows passkeys.
 */
function AcceptInvitePage() {
  const { t } = useTranslation("auth-flow");
  const { token } = Route.useSearch();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();
  const acceptWithPasskey = useAcceptInviteWithPasskey();
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const isAccountExists = (e: unknown) =>
    e instanceof ApiError && e.code === "invite.account_exists";
  const accountExists =
    preview.data?.account_exists === true ||
    isAccountExists(accept.error) ||
    isAccountExists(acceptWithPasskey.error);
  const isPending = accept.isPending || acceptWithPasskey.isPending;
  const offersPasskey = preview.data?.methods.passkey === true;
  const formError = acceptWithPasskey.error
    ? passkeyErrorMessage(acceptWithPasskey.error)
    : accept.error
      ? errorMessage(accept.error)
      : undefined;

  if (!token) {
    return (
      <InviteNotice title={t("invite.invalidTitle")} description={t("invite.invalidDescription")} />
    );
  }
  if (preview.isLoading) {
    return <InviteNotice title={t("invite.loadingTitle")} />;
  }
  if (preview.error) {
    return (
      <InviteNotice
        title={t("invite.unavailableTitle")}
        description={errorMessage(preview.error)}
      />
    );
  }
  const invited = preview.data
    ? { organization: preview.data.organization.name, email: preview.data.email }
    : undefined;

  return (
    <div className="auth-entry">
      <BrandHero intent="signup" />
      <AuthFormCard>
        <form
          aria-busy={isPending}
          onSubmit={(e) => {
            e.preventDefault();
            acceptWithPasskey.reset();
            accept.mutate({
              token,
              password,
              display_name: displayName.trim() || undefined,
            });
          }}
        >
          <div className="auth-form-header">
            <h1 className="auth-form-title">{t("invite.acceptTitle")}</h1>
            <p className="auth-form-description">
              {invited ? t("invite.acceptDescriptionFor", invited) : t("invite.acceptDescription")}
            </p>
          </div>

          <div className="auth-fields">
            <Field className="auth-field">
              <FieldLabel htmlFor="display_name">{t("invite.displayNameLabel")}</FieldLabel>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("invite.displayNamePlaceholder")}
                autoComplete="name"
              />
            </Field>

            <Field className="auth-field">
              <FieldLabel htmlFor="password">{t("invite.passwordLabel")}</FieldLabel>
              <PasswordInput
                id="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <FieldDescription>{t("invite.passwordHelp")}</FieldDescription>
            </Field>
          </div>

          {/* An existing account isn't a failure to retype — it needs a
              different route entirely, so it gets a recovery action rather than
              a red error line. */}
          {accountExists ? (
            <div className="mt-4 rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium">{t("invite.accountExistsTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("invite.accountExistsHelp")}</p>
              <Link
                to="/sign-in"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}
              >
                {t("invite.accountExistsCta")}
              </Link>
            </div>
          ) : formError ? (
            <FieldError className="auth-form-error">{formError}</FieldError>
          ) : null}

          <Button
            type="submit"
            className="auth-submit"
            disabled={isPending || accountExists || password.length < 8}
          >
            {accept.isPending && <LoaderCircleIcon className="animate-spin" />}
            {accept.isPending ? t("invite.joiningBtn") : t("invite.acceptBtn")}
          </Button>

          {offersPasskey && (
            <>
              <AuthDivider>{t("invite.passkeyDivider")}</AuthDivider>
              <PasskeyButton
                data-auth-method="passkey"
                isLoading={acceptWithPasskey.isPending}
                disabled={isPending || accountExists}
                onClick={() => {
                  accept.reset();
                  acceptWithPasskey.mutate({
                    token,
                    display_name: displayName.trim() || undefined,
                  });
                }}
              />
            </>
          )}

          <p className="auth-form-switch">
            <Link to="/sign-in" className="auth-link">
              {t("invite.backToSignIn")}
            </Link>
          </p>
        </form>
      </AuthFormCard>
    </div>
  );
}
