import { ArrowRightIcon, ShieldXIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  formatNumber,
  Heading,
  Text,
} from "@qeetrix/react";
import { DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { userQueries } from "@/modules/users";
import { type Anomaly, isAnomalyResolved } from "@/modules/security/api/anomalies";
import { useBotOverview } from "@/modules/security/api/bots";
import { anomalyFacts, sourceAddress } from "@/modules/security/anomaly-model";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { AnomalySeverityBadge } from "../anomaly-badges";
import { When } from "../when";
import { useAnomalyText } from "./anomaly-text";
import { useDenyAddress } from "./use-deny-address";

/**
 * One anomaly, read in full: what the lockout counted and did, where it came from and what else
 * came from there (other anomalies, the bot log, the IP rules), then what to do. Resolving marks
 * it dealt with: it lifts no lock and changes nothing for the account (threat.Resolve).
 */
export function AnomalyDrawer({
  anomaly,
  all,
  now,
  canWrite,
  onResolve,
  resolving,
  onOpenChange,
}: {
  anomaly: Anomaly | null;
  all: readonly Anomaly[];
  now: number;
  canWrite: boolean;
  onResolve: (a: Anomaly) => void;
  resolving: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("security");
  const text = useAnomalyText();
  return (
    <Drawer open={!!anomaly} onOpenChange={onOpenChange}>
      {anomaly ? (
        <DrawerContent
          size="md"
          title={text.title(anomaly)}
          description={
            <span className="sec-drawer-status">
              <AnomalySeverityBadge severity={anomaly.severity} />
              {isAnomalyResolved(anomaly) ? (
                <span>
                  {t("anomalies.drawer.resolved")}{" "}
                  {anomaly.resolved_at ? <When at={anomaly.resolved_at} now={now} /> : null}
                </span>
              ) : (
                <span>
                  {t("anomalies.drawer.openSince")} <When at={anomaly.created_at} now={now} />
                </span>
              )}
            </span>
          }
        >
          <AnomalyBody anomaly={anomaly} all={all} canWrite={canWrite} />
          <DrawerFooter>
            <DrawerClose render={<Button variant="soft">{t("common.close")}</Button>} />
            {canWrite && !isAnomalyResolved(anomaly) ? (
              <Button loading={resolving} onClick={() => onResolve(anomaly)}>
                {t("anomalies.actions.resolve")}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function AnomalyBody({
  anomaly: a,
  all,
  canWrite,
}: {
  anomaly: Anomaly;
  all: readonly Anomaly[];
  canWrite: boolean;
}) {
  const { t } = useTranslation("security");
  const text = useAnomalyText();
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const tenantId = useTenantId();
  const access = useCapabilities();
  const f = anomalyFacts(a);
  const ip = sourceAddress(a);
  const denial = useDenyAddress();
  const bots = useBotOverview();
  const stats = useQuery({
    ...userQueries.stats(tenantId),
    enabled: !!tenantId && access.can("user.read"),
    meta: { silent: true },
  });

  const sameSource = ip ? all.filter((x) => x.id !== a.id && anomalyFacts(x).network === ip) : [];
  const botHits = ip ? (bots.data?.recent ?? []).filter((e) => e.ip === ip) : [];
  const wouldBlock = botHits.filter((e) => e.verdict === "blocked").length;
  const deniedBy = ip ? denial.deniedBy(ip) : undefined;
  const ended = f.until ? Date.parse(f.until) <= Date.now() : false;
  const twoStep = stats.data?.total
    ? t("anomalies.drawer.twoStepShare", {
        n: n(stats.data.mfa_enabled),
        total: n(stats.data.total),
      })
    : undefined;

  return (
    <DrawerBody>
      <div className="sec-drawer">
        <Text>{text.line(a)}</Text>
        {f.until ? (
          <Text tone="subtle" size="sm">
            {t(
              f.throttled
                ? ended
                  ? "anomalies.drawer.throttledEnded"
                  : "anomalies.drawer.throttledUntil"
                : ended
                  ? "anomalies.drawer.lockedEnded"
                  : "anomalies.drawer.lockedUntil",
              { when: formatDateTime(f.until, locale) },
            )}
          </Text>
        ) : null}
        <DescriptionList>
          {f.network || f.networks ? (
            <DescriptionItem term={t("anomalies.drawer.from")}>
              {f.networks && f.networks > 1 ? (
                t("anomalies.networks", { count: f.networks })
              ) : (
                <span className="sec-mono">{f.network}</span>
              )}
            </DescriptionItem>
          ) : null}
          {a.user_email ? (
            <DescriptionItem term={t("anomalies.drawer.account")}>
              {a.user_id ? (
                <Link className="sec-link" to="/users/$userId" params={{ userId: a.user_id }}>
                  {a.user_email}
                </Link>
              ) : (
                a.user_email
              )}
            </DescriptionItem>
          ) : null}
          {f.accounts !== undefined ? (
            <DescriptionItem term={t("anomalies.drawer.accountsTried")}>
              {n(f.accounts)}
            </DescriptionItem>
          ) : null}
          {f.failures !== undefined ? (
            <DescriptionItem term={t("anomalies.drawer.failures")}>
              {f.windowMinutes !== undefined
                ? t("anomalies.drawer.failuresIn", { n: n(f.failures), minutes: f.windowMinutes })
                : n(f.failures)}
            </DescriptionItem>
          ) : null}
          <DescriptionItem term={t("anomalies.drawer.detected")}>
            {formatDateTime(a.created_at, locale)}
          </DescriptionItem>
          {ip ? (
            <DescriptionItem term={t("anomalies.drawer.seenBefore")}>
              {sameSource.length ? (
                <Link className="sec-link" to="/security/threats/anomalies" search={{ q: ip }}>
                  {t("anomalies.drawer.others", { count: sameSource.length })}
                </Link>
              ) : (
                t("anomalies.drawer.noOthers")
              )}
            </DescriptionItem>
          ) : null}
          {ip && bots.data ? (
            <DescriptionItem term={t("anomalies.drawer.bots")}>
              {botHits.length ? (
                <Link className="sec-link" to="/security/threats/bots" search={{ q: ip }}>
                  {t("anomalies.drawer.botHits", { count: botHits.length, blocked: n(wouldBlock) })}
                </Link>
              ) : (
                t("anomalies.drawer.noBotHits")
              )}
            </DescriptionItem>
          ) : null}
          {ip && denial.loaded ? (
            <DescriptionItem term={t("anomalies.drawer.ipRules")}>
              {deniedBy
                ? t(denial.enforced ? "anomalies.drawer.deniedOn" : "anomalies.drawer.deniedOff", {
                    cidr: deniedBy,
                  })
                : t(denial.enforced ? "anomalies.drawer.noRuleOn" : "anomalies.drawer.noRuleOff")}
            </DescriptionItem>
          ) : null}
        </DescriptionList>

        <section className="sec-steps" aria-labelledby={`steps-${a.id}`}>
          <Heading level={3} size="title-sm" id={`steps-${a.id}`}>
            {t("anomalies.drawer.whatToDo")}
          </Heading>
          <ol>
            {ip && !deniedBy && canWrite ? (
              <li>
                <strong>{t("anomalies.drawer.denyTitle")}</strong>
                <small>
                  {t(denial.enforced ? "anomalies.drawer.denyOn" : "anomalies.drawer.denyOff", {
                    ip,
                  })}
                </small>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ShieldXIcon}
                  loading={denial.pending}
                  onClick={() => void denial.deny(ip, t("deny.label", { what: text.title(a) }))}
                >
                  {t("anomalies.actions.deny", { ip })}
                </Button>
              </li>
            ) : null}
            {/* A Button as a router link is announced as a button until QTRX-8. */}
            {a.user_id ? (
              <li>
                <strong>{t("anomalies.drawer.checkTitle")}</strong>
                <small>{t("anomalies.drawer.checkLine")}</small>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ArrowRightIcon}
                  render={<Link to="/users/$userId" params={{ userId: a.user_id }} />}
                >
                  {t("anomalies.actions.account")}
                </Button>
              </li>
            ) : null}
            <li>
              <strong>{t("anomalies.drawer.twoStepTitle")}</strong>
              <small>
                {t("anomalies.drawer.twoStepLine")}
                {twoStep ? ` ${twoStep}` : ""}
              </small>
              <Button
                variant="ghost"
                size="sm"
                icon={ArrowRightIcon}
                render={<Link to="/settings/organization/security-policy" />}
              >
                {t("anomalies.drawer.twoStepLink")}
              </Button>
            </li>
          </ol>
        </section>
        {!isAnomalyResolved(a) ? (
          <Text tone="subtle" size="sm">
            {t("anomalies.drawer.resolveNote")}
          </Text>
        ) : null}
      </div>
    </DrawerBody>
  );
}
