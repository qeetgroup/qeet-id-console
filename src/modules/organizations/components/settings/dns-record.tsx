import { CopyButton } from "@qeetrix/react/experimental";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** A DNS record to publish: its type, then its name and value, each copied on its own, as a DNS
 * provider's form asks for them. */
export function DnsRecord({
  type,
  name,
  value,
  note,
}: {
  type: string;
  name: string;
  value: string;
  note?: ReactNode;
}) {
  const { t } = useTranslation("organizations");
  return (
    <div className="dns">
      <dl className="dns-record">
        <div>
          <dt>{t("settings.dns.type")}</dt>
          <dd>
            <span className="account-mono">{type}</span>
          </dd>
        </div>
        <div>
          <dt>{t("settings.dns.name")}</dt>
          <dd>
            <span className="account-mono">{name}</span>
            <CopyButton value={name} label={t("settings.dns.copyName", { type })} size="sm" />
          </dd>
        </div>
        <div>
          <dt>{t("settings.dns.value")}</dt>
          <dd>
            <span className="account-mono">{value}</span>
            <CopyButton value={value} label={t("settings.dns.copyValue", { type })} size="sm" />
          </dd>
        </div>
      </dl>
      {note ? <p className="account-note">{note}</p> : null}
    </div>
  );
}
