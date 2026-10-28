import {
  BuildingComplexIcon,
  GaugeIcon,
  OctagonXIcon,
  PaletteIcon,
  PencilIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  TrashIcon,
  UploadIcon,
  UserXIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  formatDate,
  formatNumber,
  formatRelativeTime,
  Link,
  type QeetrixIcon,
} from "@qeetrix/react";
import { Timeline, TimelineGroup, TimelineItem } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { OrgAuditEvent } from "@/modules/organizations/api/orgs";
import {
  activityAt,
  activitySince,
  changesByMonth,
  monthLevel,
} from "@/modules/organizations/orgs-model";
import { parseUserAgent } from "@/modules/users";
import { OrgSection } from "./org-section";

type Kind = { icon: QeetrixIcon; tone?: "warning" | "success" };
// Each change the page names: its icon, and the deletion's colour. Others read from the action.
const KINDS: Record<string, Kind> = {
  "tenant.created": { icon: BuildingComplexIcon },
  "tenant.updated": { icon: PencilIcon },
  "tenant.deletion_scheduled": { icon: TrashIcon, tone: "warning" },
  "tenant.deletion_cancelled": { icon: RotateCcwIcon, tone: "success" },
  "tenant.suspended": { icon: UserXIcon, tone: "warning" },
  "tenant.reactivated": { icon: RotateCcwIcon },
  "branding.updated": { icon: PaletteIcon },
  "security_policy.updated": { icon: ShieldCheckIcon },
  "rate_limits.updated": { icon: GaugeIcon },
  "rate_limits.deleted": { icon: GaugeIcon },
  "agent.kill_switch": { icon: OctagonXIcon, tone: "warning" },
  "user.bulk_imported": { icon: UploadIcon },
};
const KEY = (action: string) => action.replace(/[._]/g, "-");
// "last month" as a heading starts with a capital: "Last month".
const sentence = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * History: the changes to the organisation itself (its record, branding, sign-in rules…), summed
 * up (how many, by how many people, the last one), as a strip of months since it was made, then
 * each change by year: what, who, from which browser and address, and when. Each opens its record
 * in Activity. `names` are the people who made them, by id, where they can be read.
 */
export function HistorySection({
  changes,
  created,
  now,
  names,
}: {
  changes: OrgAuditEvent[];
  created: string;
  now: number;
  names: ReadonlyMap<string, string>;
}) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const who = (e: OrgAuditEvent) =>
    e.actor_user_id
      ? (names.get(e.actor_user_id) ?? t("page.history.someone"))
      : t("page.history.qeetId");
  const title = (e: OrgAuditEvent) =>
    t(`page.history.kinds.${KEY(e.action)}`, {
      defaultValue: e.action,
      date:
        typeof e.metadata?.deletion_due_at === "string"
          ? formatDate(e.metadata.deletion_due_at, locale, { dateStyle: "long" })
          : "",
    });
  const people = [...new Set(changes.map(who))];
  const last = changes.find((c) => c.action !== "tenant.created") ?? changes[0];
  const years = [...new Set(changes.map((c) => new Date(c.created_at).getFullYear()))];
  const months = changesByMonth(changes, created, now);
  const monthName = (d: Date) => d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const busy = months.filter((m) => m.count);

  return (
    <OrgSection
      id="org-history"
      title={t("page.history.heading")}
      note={t("page.history.note")}
      action={
        <Link
          className="org-page-link"
          render={<RouterLink to="/activity" search={activitySince(created, now)} />}
        >
          {t("page.history.all")}
        </Link>
      }
    >
      {changes.length ? (
        <>
          <div className="org-hist">
            <dl className="org-hist-facts">
              <div>
                <dt className="org-id-cap">{t("page.history.changes")}</dt>
                <dd className="org-id-value">{n(changes.length)}</dd>
                <dd className="org-id-note">
                  {t("page.history.since", {
                    date: formatDate(created, locale, { dateStyle: "long" }),
                  })}
                </dd>
              </div>
              <div>
                <dt className="org-id-cap">{t("page.history.by")}</dt>
                <dd className="org-id-value">
                  {t("page.history.people", { count: people.length, n: n(people.length) })}
                </dd>
                <dd className="org-id-note">
                  {people.length > 2
                    ? t("page.history.namesMore", {
                        names: people.slice(0, 2).join(", "),
                        n: n(people.length - 2),
                      })
                    : people.join(t("page.history.and"))}
                </dd>
              </div>
              {last ? (
                <div>
                  <dt className="org-id-cap">{t("page.history.last")}</dt>
                  <dd className="org-id-value">
                    {sentence(formatRelativeTime(Date.parse(last.created_at), locale, now))}
                  </dd>
                  <dd className="org-id-note">
                    {t("page.history.lastNote", { what: title(last), who: who(last) })}
                  </dd>
                </div>
              ) : null}
            </dl>
            <figure className="org-strip">
              <figcaption className="org-id-cap">{t("page.history.byMonth")}</figcaption>
              <div
                className="org-strip-cells"
                role="img"
                aria-label={t("page.history.byMonthLabel", {
                  since: monthName(months[0]?.month ?? new Date(created)),
                  months: busy.length
                    ? busy
                        .map((m) =>
                          t("page.history.monthCount", {
                            month: monthName(m.month),
                            count: m.count,
                            n: n(m.count),
                          }),
                        )
                        .join("; ")
                    : t("page.history.noChanges"),
                })}
                style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
              >
                {months.map((m) => (
                  <span
                    key={m.month.getTime()}
                    className={`org-strip-cell is-${monthLevel(m.count)}`}
                  >
                    {m.count ? <b>{n(m.count)}</b> : null}
                  </span>
                ))}
              </div>
              <div
                className="org-strip-axis"
                aria-hidden="true"
                style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
              >
                {months.map((m, i) => (
                  <span key={m.month.getTime()}>
                    {i === 0
                      ? m.month.toLocaleDateString(locale, { month: "short", year: "numeric" })
                      : m.month.getMonth() === 0
                        ? m.month.getFullYear()
                        : i === months.length - 1
                          ? m.month.toLocaleDateString(locale, { month: "short" })
                          : ""}
                  </span>
                ))}
              </div>
            </figure>
          </div>

          <Timeline className="org-changes">
            {years.map((year) => (
              <TimelineGroup key={year} label={String(year)}>
                {changes
                  .filter((c) => new Date(c.created_at).getFullYear() === year)
                  .map((c) => {
                    const kind: Kind = KINDS[c.action] ?? { icon: PencilIcon };
                    const name = who(c);
                    return (
                      <TimelineItem
                        key={c.id}
                        title={
                          <RouterLink
                            className="org-change-link"
                            to="/activity"
                            search={activityAt(c)}
                          >
                            {title(c)}
                          </RouterLink>
                        }
                        description={
                          <span className="org-by">
                            {c.actor_user_id ? <Avatar name={name} size="sm" decorative /> : null}
                            <span>{name}</span>
                            {c.user_agent ? (
                              <span>· {parseUserAgent(c.user_agent).label}</span>
                            ) : null}
                            {c.ip ? <span>· {c.ip}</span> : null}
                          </span>
                        }
                        time={formatDate(c.created_at, locale, { dateStyle: "medium" })}
                        dateTime={c.created_at}
                        icon={kind.icon}
                        tone={kind.tone}
                      />
                    );
                  })}
              </TimelineGroup>
            ))}
          </Timeline>
        </>
      ) : (
        <p className="org-page-note">{t("page.history.empty")}</p>
      )}
    </OrgSection>
  );
}
