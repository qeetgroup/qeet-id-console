import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline } from "@/modules/dashboard";
import type { Invitation } from "@/modules/users/api/invitations";
import {
  daysLeft,
  type InvitationFilters,
  joinDays,
  LINK_DAYS,
  median,
  sentByMonth,
} from "@/modules/users/invitations-model";
import { DAY_MS } from "@/modules/users/people-model";
import { JoinBars } from "./join-bars";

const MONTHS = 15;

/**
 * The tab's key numbers, in its header above the tabs: who's waiting and when the next link
 * expires, how fast people join against the link's 14 days, what's been sent, and the outcomes.
 * Each count opens the list filtered to it.
 */
export function InvitationsBand({ invites, now }: { invites: Invitation[]; now: number }) {
  const { t } = useTranslation("users");
  const n = (value: number) => formatNumber(value, formatLocale());
  const to = (search: InvitationFilters) => ({ to: "/invitations" as const, search });
  const count = (status: Invitation["status"]) => invites.filter((i) => i.status === status).length;

  const waiting = invites.filter((i) => i.status === "pending");
  const nextExpiry = waiting.length ? Math.min(...waiting.map((i) => daysLeft(i, now))) : null;
  const joined = invites.map(joinDays).filter((d): d is number => d !== null);
  const typical = median(joined);
  const slowest = joined.length ? Math.ceil(Math.max(...joined)) : 0;
  const recent = invites.filter((i) => now - Date.parse(i.created_at) < 30 * DAY_MS).length;
  const outcomes = [
    { id: "accepted", count: count("accepted"), tone: undefined },
    { id: "pending", count: count("pending"), tone: undefined },
    { id: "expired", count: count("expired"), tone: "is-warning" },
    { id: "revoked", count: count("revoked"), tone: undefined },
  ] as const;

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("invites.band.waiting")}</dt>
        <dd className="ppl-value">{n(waiting.length)}</dd>
        <dd className="ppl-note">
          {nextExpiry === null
            ? t("invites.band.noneWaiting")
            : nextExpiry <= 1
              ? t("invites.band.nextExpiresToday")
              : t("invites.band.nextExpires", { count: nextExpiry })}
        </dd>
        {waiting.length ? (
          <dd className="ppl-link">
            <Link {...to({ status: "pending" })}>{t("invites.band.seeWaiting")}</Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("invites.band.timeToJoin")}</dt>
        <dd className="ppl-value">
          {typical === null
            ? "—"
            : t("invites.band.days", {
                n: typical.toLocaleString(formatLocale(), { maximumFractionDigits: 1 }),
              })}
        </dd>
        <dd className="ppl-note">
          {typical === null
            ? t("invites.band.noneJoined")
            : t("invites.band.allWithin", { count: slowest })}
        </dd>
        {joined.length ? (
          <dd className="ppl-chart">
            <JoinBars
              values={joined}
              label={t("invites.band.joinBarsLabel", {
                n: joined.length,
                days: slowest,
                link: LINK_DAYS,
              })}
              end={t("invites.band.days", { n: LINK_DAYS })}
            />
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("invites.band.sent")}</dt>
        <dd className="ppl-value">{n(invites.length)}</dd>
        <dd className="ppl-note">{t("invites.band.sentRecently", { n: recent })}</dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("invites.band.sentLabel", { months: MONTHS, n: invites.length })}
          >
            <Sparkline values={sentByMonth(invites, now, MONTHS)} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("invites.band.months", { months: MONTHS })}
          </span>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("invites.band.outcomes")}</dt>
        <dd className="ppl-looks">
          <ul>
            {outcomes.map((o) => (
              <li key={o.id} className={o.count ? undefined : "is-zero"}>
                <Link {...to({ status: o.id })}>
                  <span>{t(`invites.band.outcome.${o.id}`)}</span>
                  <b className={o.count && o.tone ? o.tone : undefined}>{n(o.count)}</b>
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
