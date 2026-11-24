import { DownloadIcon } from "@qeetrix/icons";
import { LinkButton } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import {
  type SamlConnection,
  samlAcsUrl,
  samlMetadataUrl,
} from "@/modules/authentication/api/saml";
import {
  CopyRow,
  Detail,
  Mono,
  Section,
} from "@/modules/authentication/components/connections/connection-parts";

/**
 * What to give the identity provider: Qeet ID's ACS URL and entity ID (both carry this
 * connection's ID), the NameID it reads, and the metadata file holding all of them.
 */
export function SamlOurs({
  connection: c,
  provider,
}: {
  connection: SamlConnection;
  provider: string;
}) {
  const { t } = useTranslation("saml");
  return (
    <Section
      id="saml-ours"
      title={t("signIn.ours.title", { provider })}
      description={t("signIn.ours.note", { provider })}
    >
      <dl className="account-details">
        <CopyRow
          label={t("signIn.ours.acs")}
          value={samlAcsUrl(c.id)}
          hint={t("signIn.ours.acsHint", { provider })}
          copyLabel={t("signIn.ours.copyAcs")}
        />
        <CopyRow
          label={t("signIn.ours.entity")}
          value={samlMetadataUrl(c.id)}
          hint={t("signIn.ours.entityHint", { provider })}
          copyLabel={t("signIn.ours.copyEntity")}
        />
        <Detail
          label={t("signIn.ours.nameId")}
          hint={t("signIn.ours.nameIdHint", { attribute: c.email_attribute || "email" })}
        >
          {t("signIn.ours.nameIdValue")}
        </Detail>
        <Detail
          label={t("signIn.ours.metadata")}
          hint={t("signIn.ours.metadataHint")}
          action={
            <LinkButton
              variant="ghost"
              icon={DownloadIcon}
              href={samlMetadataUrl(c.id)}
              target="_blank"
              rel="noreferrer"
            >
              {t("signIn.ours.open")}
            </LinkButton>
          }
        >
          <Mono>{t("signIn.ours.metadataFile")}</Mono>
        </Detail>
      </dl>
    </Section>
  );
}
