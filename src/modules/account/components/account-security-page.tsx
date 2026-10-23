import {
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qeetrix/ui";
import { ShieldCheckIcon } from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
  AccountPasskeysCard,
  LinkedPhonesCard,
  TrustedDevicesCard,
} from "@/modules/authentication";
import { ConnectedAccountsCard } from "./connected-accounts-card";
import { PasswordCard } from "./password-card";

/**
 * Renders how the signed-in person signs in: password, second factors, passkeys, linked phones,
 * remembered devices and connected accounts.
 */
export function AccountSecurityPage() {
  const { t } = useTranslation("account");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PasswordCard />

      <Card>
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

      {/* The person's own passkeys, not the Login methods admin screen. */}
      <AccountPasskeysCard className="md:col-span-2" />

      {/* Phones that approve sign-ins with Qeet Auth, linked with a pairing code. */}
      <LinkedPhonesCard scope={{ kind: "self" }} className="md:col-span-2" />

      {/* Devices remembered so they skip the second factor: listed and forgotten here. */}
      <TrustedDevicesCard scope={{ kind: "self" }} className="md:col-span-2" />

      <ConnectedAccountsCard className="md:col-span-2" />
    </div>
  );
}
