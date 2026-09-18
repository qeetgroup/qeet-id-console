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
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAcceptInvite } from "@/modules/authentication";
import { AuthFormCard } from "@/modules/authentication/components/auth-form-card";
import { BrandHero } from "@/modules/authentication/components/brand-hero";
import { ApiError } from "@/platform/api/client";
import { errorMessage } from "@/platform/errors/user-message";

export const Route = createFileRoute("/_auth/invite/accept")({
  component: AcceptInvitePage,
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

/**
 * Accepting an invite is a sign-up, so it uses the same shell as /sign-up:
 * `auth-entry` (hero + fixed-width card) rather than a bare <Card>, which
 * rendered as a narrow panel floating at a different width and offset from
 * every other auth route.
 */
function AcceptInvitePage() {
  const { t } = useTranslation("auth-flow");
  const { token } = Route.useSearch();
  const accept = useAcceptInvite();
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const accountExists =
    accept.error instanceof ApiError && accept.error.code === "invite.account_exists";

  if (!token) {
    return (
      <div className="auth-entry">
        <BrandHero />
        <AuthFormCard>
          <div className="auth-form-header">
            <h1 className="auth-form-title">{t("invite.invalidTitle")}</h1>
            <p className="auth-form-description">{t("invite.invalidDescription")}</p>
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

  return (
    <div className="auth-entry">
      <BrandHero intent="signup" />
      <AuthFormCard>
        <form
          aria-busy={accept.isPending}
          onSubmit={(e) => {
            e.preventDefault();
            accept.mutate({
              token,
              password,
              display_name: displayName.trim() || undefined,
            });
          }}
        >
          <div className="auth-form-header">
            <h1 className="auth-form-title">{t("invite.acceptTitle")}</h1>
            <p className="auth-form-description">{t("invite.acceptDescription")}</p>
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
          ) : accept.error ? (
            <FieldError className="auth-form-error">{errorMessage(accept.error)}</FieldError>
          ) : null}

          <Button
            type="submit"
            className="auth-submit"
            disabled={accept.isPending || password.length < 8}
          >
            {accept.isPending && <Loader2Icon className="animate-spin" />}
            {accept.isPending ? t("invite.joiningBtn") : t("invite.acceptBtn")}
          </Button>

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
