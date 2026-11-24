import { InstructionList, InstructionStep } from "@qeetrix/react/experimental";
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
    <InstructionList orientation="horizontal" aria-label={t("ldap.how.label")}>
      <InstructionStep
        title={t("ldap.how.bind")}
        value={c.bind_dn}
        note={t("ldap.how.bindNote", {
          host: hostOf(c.server_url),
          how: t(`ldap.server.encryptionWord.${encryption}`),
        })}
      />
      <InstructionStep
        title={t("ldap.how.find")}
        value={
          <>
            {c.user_filter}
            <br />
            {c.base_dn}
          </>
        }
        note={t("ldap.how.findNote")}
      />
      <InstructionStep title={t("ldap.how.check")} note={t("ldap.how.checkNote")} />
      <InstructionStep
        title={t("ldap.how.signIn")}
        value={t("ldap.how.maps", { email: c.email_attribute, name: c.name_attribute })}
        note={t("ldap.how.signInNote", { org })}
      />
    </InstructionList>
  );
}
