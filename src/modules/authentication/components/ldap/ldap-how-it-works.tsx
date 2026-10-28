import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import type { LdapConnection } from "@/modules/authentication/api/ldap";
import { hostOf, ldapEncryption } from "@/modules/authentication/connections-model";

/**
 * How a sign-in goes through this connection, in the server's order
 * (internal/federation/ldap): Qeet ID binds as the service account, searches under the base DN
 * with the filter (the typed name in place of %s; exactly one entry must match), binds as that
 * entry with the typed password, then reads the email and name attributes, making the account the
 * first time only for an address on a domain the organisation has verified. Each step shows this
 * connection's own value.
 */
export function LdapHowItWorks({
  connection: c,
  org,
}: {
  connection: LdapConnection;
  org: string;
}) {
  const { t } = useTranslation("connections");
  const encryption = ldapEncryption(c);
  return (
    <ol
      className="cx-flow"
      aria-label={t("ldap.how.label")}
      style={{ "--cx-flow-steps": 4 } as CSSProperties}
    >
      <li className="cx-flow-step">
        <p className="cx-flow-cap">{t("ldap.how.bind")}</p>
        <p className="cx-flow-value">{c.bind_dn}</p>
        <p className="cx-flow-note">
          {t("ldap.how.bindNote", {
            host: hostOf(c.server_url),
            how: t(`ldap.server.encryptionWord.${encryption}`),
          })}
        </p>
      </li>
      <li className="cx-flow-step">
        <p className="cx-flow-cap">{t("ldap.how.find")}</p>
        <p className="cx-flow-value">{c.user_filter}</p>
        <p className="cx-flow-value">{c.base_dn}</p>
        <p className="cx-flow-note">{t("ldap.how.findNote")}</p>
      </li>
      <li className="cx-flow-step">
        <p className="cx-flow-cap">{t("ldap.how.check")}</p>
        <p className="cx-flow-note">{t("ldap.how.checkNote")}</p>
      </li>
      <li className="cx-flow-step">
        <p className="cx-flow-cap">{t("ldap.how.signIn")}</p>
        <p className="cx-flow-value">
          {t("ldap.how.maps", { email: c.email_attribute, name: c.name_attribute })}
        </p>
        <p className="cx-flow-note">{t("ldap.how.signInNote", { org })}</p>
      </li>
    </ol>
  );
}
