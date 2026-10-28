import { FlaskConicalIcon } from "@qeetrix/icons";
import { Button, formatDate, formatDateTime, formatRelativeTime } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { SamlConnection, SamlTestResult } from "@/modules/authentication/api/saml";
import {
  type Check,
  CheckList,
  Detail,
  Section,
} from "@/modules/authentication/components/connections/connection-parts";

/**
 * A SAML connection's last step: the server's five offline checks (run here, nothing is sent to
 * the provider), its status and what it means, and whether a sign-in the provider starts is
 * accepted (the server: only request correlation is relaxed; signatures and replays are still
 * checked).
 */
export function SamlTurnOn({
  connection: c,
  canWrite,
  provider,
  checked,
  running,
  onRun,
  notAfter,
  onSetOn,
  onSetIdpInitiated,
}: {
  connection: SamlConnection;
  canWrite: boolean;
  provider: string;
  checked: { result: SamlTestResult; at: number } | null;
  running: boolean;
  onRun: () => void;
  notAfter: Date | undefined;
  onSetOn: (on: boolean) => void;
  onSetIdpInitiated: (allow: boolean) => void;
}) {
  const { t } = useTranslation("saml");
  const locale = formatLocale();
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), locale, Date.now());
  return (
    <Section
      id="saml-turn-on"
      title={t("signIn.turnOn.title")}
      description={t("signIn.turnOn.note", { provider })}
    >
      <CheckList
        checks={checksOf(t, c, checked?.result, running, notAfter, locale)}
        footer={
          <>
            <span>
              {checked
                ? t("signIn.turnOn.checkedAt", {
                    when: formatRelativeTime(checked.at, locale, Date.now()),
                  })
                : t("signIn.turnOn.notChecked")}
            </span>
            {canWrite ? (
              <Button variant="ghost" icon={FlaskConicalIcon} loading={running} onClick={onRun}>
                {checked ? t("signIn.turnOn.again") : t("signIn.turnOn.run")}
              </Button>
            ) : null}
          </>
        }
      />
      <dl className="account-details">
        <Detail
          label={t("signIn.status.title")}
          hint={t(`signIn.status.means.${c.status}`)}
          action={
            canWrite ? (
              c.status === "active" ? (
                <Button variant="ghost" onClick={() => onSetOn(false)}>
                  {t("signIn.off.button")}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => onSetOn(true)}>
                  {t("signIn.on.button")}
                </Button>
              )
            ) : undefined
          }
        >
          {t(`signIn.status.word.${c.status}`)}
          {c.last_login_at ? (
            <small className="cx-none">
              {" · "}
              {t("signIn.status.lastSignIn", {
                when: ago(c.last_login_at),
                date: formatDateTime(c.last_login_at, locale),
              })}
            </small>
          ) : null}
        </Detail>
        <Detail
          label={t("signIn.idpInitiated.title", { provider })}
          hint={
            c.allow_idp_initiated
              ? t("signIn.idpInitiated.acceptedHint", { provider })
              : t("signIn.idpInitiated.notAcceptedHint")
          }
          action={
            canWrite ? (
              <Button variant="ghost" onClick={() => onSetIdpInitiated(!c.allow_idp_initiated)}>
                {c.allow_idp_initiated
                  ? t("signIn.idpInitiated.stop")
                  : t("signIn.idpInitiated.accept")}
              </Button>
            ) : undefined
          }
        >
          {c.allow_idp_initiated
            ? t("signIn.idpInitiated.accepted")
            : t("signIn.idpInitiated.notAccepted")}
        </Detail>
      </dl>
    </Section>
  );
}

type T = ReturnType<typeof useTranslation<"saml">>["t"];

// The server's five checks (internal/federation/saml: TestConnection), by the names it gives them.
const CHECKS = [
  ["IdP entity ID", "entity"],
  ["IdP SSO URL", "ssoUrl"],
  ["Signing certificate", "certificate"],
  ["Certificate validity period", "validity"],
  ["Email attribute mapping", "email"],
] as const;

/** The checks, as last run here, or not run yet; each says what it checked. */
function checksOf(
  t: T,
  c: SamlConnection,
  result: SamlTestResult | undefined,
  running: boolean,
  notAfter: Date | undefined,
  locale: string,
): Check[] {
  return CHECKS.map(([name, id]) => {
    const got = result?.checks.find((check) => check.name === name);
    const detail =
      id === "entity"
        ? c.idp_entity_id
        : id === "ssoUrl"
          ? c.idp_sso_url
          : id === "validity" && notAfter
            ? t("signIn.checks.until", {
                date: formatDate(notAfter, locale, { dateStyle: "medium" }),
              })
            : id === "email"
              ? c.email_attribute || undefined
              : undefined;
    return {
      label: t(`signIn.checks.${id}`),
      detail,
      state: running ? "running" : !got ? "todo" : got.ok ? "ok" : "fail",
    };
  });
}
