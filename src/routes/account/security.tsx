import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  StatusPill,
} from "@qeetrix/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FingerprintIcon,
  KeyRoundIcon,
  LinkIcon,
  Loader2Icon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { socialStartUrl, useChangePassword, usePlatformSocialProviders } from "@/lib/auth";
import { usePasskeys } from "@/lib/passkeys";
import { useSocialIdentities, useUnlinkIdentity } from "@/lib/social-identities";

export const Route = createFileRoute("/account/security")({
  component: SecurityPage,
});

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SecurityPage() {
  const { t } = useTranslation("account");
  const passkeysQ = usePasskeys();
  const passkeyCount = passkeysQ.data?.items?.length ?? 0;
  const identitiesQ = useSocialIdentities();
  const identities = identitiesQ.data?.items ?? [];
  const unlink = useUnlinkIdentity();

  // Providers the user can still link: configured on the platform and not
  // already linked. "Linking" = signing in with that provider using the same
  // email, which the callback attaches to this account (findOrCreateUser).
  const providersQ = usePlatformSocialProviders();
  const linkedProviders = new Set(identities.map((i) => i.provider.toLowerCase()));
  const linkable = (providersQ.data?.providers ?? []).filter(
    (p) => !linkedProviders.has(p.toLowerCase()),
  );

  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const submitPassword = () => {
    changePassword.mutate(
      { current_password: current, new_password: next },
      {
        onSuccess: () => {
          toast.success("Your password has been updated.");
          setCurrent("");
          setNext("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Could not update your password."),
      },
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">{t("security.password.title")}</CardTitle>
            </div>
            <StatusPill status="active" />
          </div>
          <CardDescription>{t("security.password.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPassword();
            }}
            className="grid max-w-sm gap-3"
          >
            <Field>
              <FieldLabel htmlFor="current-password">Current password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={changePassword.isPending || !current || next.length < 8}
              >
                {changePassword.isPending && <Loader2Icon className="animate-spin" />}
                {t("security.password.reset", { defaultValue: "Update password" })}
              </Button>
              <Link
                to="/forgot-password"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Passkeys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FingerprintIcon className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">{t("security.passkeys.title")}</CardTitle>
            </div>
            <StatusPill status={passkeyCount > 0 ? "active" : "pending"} dot={false}>
              {passkeyCount > 0
                ? t("security.passkeys.enrolled", { count: passkeyCount })
                : t("security.passkeys.notEnrolled")}
            </StatusPill>
          </div>
          <CardDescription>{t("security.passkeys.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/auth/login-methods/passkeys"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FingerprintIcon /> {t("security.passkeys.manage")}
          </Link>
        </CardContent>
      </Card>

      {/* Two-factor */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.mfa.title")}</CardTitle>
          </div>
          <CardDescription>{t("security.mfa.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/auth/mfa/totp" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("security.mfa.totp")}
          </Link>
          <Link
            to="/auth/mfa/sms-email"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("security.mfa.smsEmail")}
          </Link>
        </CardContent>
      </Card>

      {/* Connected accounts */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{t("security.connected.title")}</CardTitle>
          </div>
          <CardDescription>{t("security.connected.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {identities.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("security.connected.empty")}</p>
          ) : (
            <ul className="divide-y">
              {identities.map((idn) => (
                <li
                  key={idn.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{titleCase(idn.provider)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {idn.email ?? "—"}{" "}
                      {t("security.connected.linkedAt", {
                        date: new Date(idn.linked_at).toLocaleDateString(),
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate(idn.id)}
                  >
                    <Trash2Icon /> {t("security.connected.unlink")}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {linkable.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-xs text-muted-foreground">
                {t("security.connected.linkPrompt", { defaultValue: "Link a provider:" })}
              </span>
              {linkable.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = socialStartUrl(p);
                  }}
                >
                  <LinkIcon /> {titleCase(p)}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
