import { formatDate, formatNumber } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { LdapConnection } from "@/modules/authentication/api/ldap";
import { eventReason, hostOf, signInDays } from "@/modules/authentication/connections-model";
import type { Check } from "@/modules/authentication/components/connections/connection-parts";
import type { DirectoryEvent } from "@/modules/directory";
import type { LdapTestOutcome } from "./use-ldap-actions";

type T = ReturnType<typeof useTranslation<"connections">>["t"];

/** The one thing a test checks, with its latest result: running now, the answer just given, the
 * latest recorded one, or never run. */
export function testCheck(
  t: T,
  c: LdapConnection,
  outcome: LdapTestOutcome | null,
  last: DirectoryEvent | undefined,
  ago: (iso: string) => string,
): Check {
  const label = t("ldap.test.check");
  const where = `${hostOf(c.server_url)} · ${c.bind_dn}`;
  if (outcome?.state === "running")
    return { label, state: "running", detail: t("ldap.test.running") };
  if (outcome?.state === "passed")
    return { label, state: "ok", detail: t("ldap.test.passedNow", { where }) };
  if (outcome?.state === "failed")
    return { label, state: "fail", detail: t(`ldap.test.failed.${outcome.reason}`) };
  if (!last) return { label, state: "todo", detail: t("ldap.test.never") };
  return last.status === "success"
    ? { label, state: "ok", detail: t("ldap.test.passed", { where, when: ago(last.started_at) }) }
    : {
        label,
        state: "fail",
        detail: t("ldap.test.failedAt", { reason: eventReason(last), when: ago(last.started_at) }),
      };
}

/** Its sign-ins a day for 30 days: those that worked, and those that failed on top. */
export function SignInDays({ events, now }: { events: readonly DirectoryEvent[]; now: number }) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const days = signInDays(events, now);
  const ok = days.reduce((sum, d) => sum + d.ok, 0);
  const failed = days.reduce((sum, d) => sum + d.failed, 0);
  const top = Math.max(1, ...days.map((d) => d.ok + d.failed));
  if (!ok && !failed) return <p className="cx-flow-note">{t("ldap.signIns.empty")}</p>;
  return (
    <div className="cx-list">
      <p className="cx-flow-note">{t("ldap.signIns.counts", { ok: n(ok), failed: n(failed) })}</p>
      <span
        className="cx-days"
        role="img"
        aria-label={t("ldap.signIns.label", { ok: n(ok), failed: n(failed) })}
      >
        {days.map((d) => (
          <span
            key={d.date}
            className="cx-day"
            title={t("ldap.signIns.day", {
              date: formatDate(d.date, locale, { dateStyle: "medium" }),
              ok: n(d.ok),
              failed: n(d.failed),
            })}
          >
            {d.failed ? (
              <span
                className="cx-day-failed"
                style={{ blockSize: `${Math.max(4, (d.failed / top) * 100)}%` }}
              />
            ) : null}
            {d.ok ? (
              <span className="cx-day-ok" style={{ blockSize: `${(d.ok / top) * 100}%` }} />
            ) : null}
          </span>
        ))}
      </span>
      <span className="cx-days-axis" aria-hidden="true">
        <span>{t("ldap.signIns.from")}</span>
        <span>{t("ldap.signIns.today")}</span>
      </span>
    </div>
  );
}
