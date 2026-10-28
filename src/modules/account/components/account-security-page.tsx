import { useTranslation } from "react-i18next";

import { AccountPage } from "./account-parts";
import { ConnectedSection } from "./security/connected-section";
import { DevicesSection } from "./security/devices-section";
import { PasskeysSection } from "./security/passkeys-section";
import { PasswordSection } from "./security/password-section";
import { TwoStepSection } from "./security/two-step-section";

/**
 * How the person signs in, and what protects the account, in one place: the second step,
 * passkeys, the password, remembered devices and connected accounts. Their organisation's rules
 * are set by its administrators, in Settings.
 */
export function AccountSecurityPage() {
  const { t } = useTranslation("account");
  return (
    <AccountPage title={t("security.title")} description={t("security.description")}>
      <TwoStepSection />
      <PasskeysSection />
      <PasswordSection />
      <DevicesSection />
      <ConnectedSection />
    </AccountPage>
  );
}
