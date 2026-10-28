import {
  Button,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  Heading,
  Table,
  Text,
} from "@qeetrix/react";
import { AvatarItem, DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline } from "@/modules/dashboard";
import { useCount } from "../lists/authz-parts";
import {
  DAY_MS,
  fieldChanges,
  type PolicyVersion,
  savesByMonth,
  type VersionFilters,
} from "./versions-model";

const MONTHS = 12;

/**
 * The band: how many policies and how many have changed since they were made; saves by month; and
 * what needs a look: changes this week, and deleted policies (nothing of them is kept).
 */
export function VersionsBand({
  all,
  policies,
  now,
}: {
  all: PolicyVersion[];
  policies: number;
  now: number;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const to = (search: VersionFilters) => ({ to: "/authorization/versions" as const, search });
  const changed = new Set(all.filter((v) => v.current && v.n > 1).map((v) => v.policyId)).size;
  const months = savesByMonth(all, now, MONTHS);
  const recent = all.filter((v) => now - Date.parse(v.event.at) <= 30 * DAY_MS).length;
  const week = all.filter((v) => now - Date.parse(v.event.at) <= 7 * DAY_MS).length;
  const deleted = all.filter((v) => v.change === "deleted").length;
  return (
    <dl className="ppl-band is-three">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.versions.band.policies")}</dt>
        <dd className="ppl-value">{n(policies)}</dd>
        <dd className="ppl-note">
          {t("lists.versions.band.policiesNote", { changed: n(changed) })}
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.versions.band.changes")}</dt>
        <dd className="ppl-value">{n(all.length)}</dd>
        <dd className="ppl-note">{t("lists.versions.band.changesNote", { n: n(recent) })}</dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("lists.versions.band.growthLabel", {
              months: MONTHS,
              counts: months.map(n).join(", "),
            })}
          >
            <Sparkline values={months} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("lists.common.months", { months: MONTHS })}
          </span>
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.common.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            <li className={week ? undefined : "is-zero"}>
              <Link {...to({ look: "week" })}>
                <span>{t("lists.versions.band.looks.week")}</span>
                <b>{n(week)}</b>
              </Link>
            </li>
            <li className={deleted ? undefined : "is-zero"}>
              <Link {...to({ change: "deleted" })}>
                <span>{t("lists.versions.band.looks.deleted")}</span>
                <b>{n(deleted)}</b>
              </Link>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  );
}

/** A version opened: the save, then what the log kept of it beside the version before. */
export function VersionDrawerContent({ version, by }: { version: PolicyVersion; by?: string }) {
  const { t } = useTranslation("authorization");
  const locale = formatLocale();
  const changes = fieldChanges(version);
  const { event } = version;
  const show = (value?: string) =>
    value ? <span className="authz-mono">{value}</span> : <Text tone="subtle">—</Text>;
  return (
    <DrawerContent
      title={t("lists.versions.drawer.title", { policy: version.policy, n: version.n })}
      description={version.current ? t("lists.versions.cells.current") : undefined}
      size="md"
    >
      <DrawerBody>
        <div className="authz-drawer">
          <DescriptionList className="authz-facts">
            <DescriptionItem term={t("lists.versions.drawer.change")}>
              {t(`lists.versions.cells.${version.change}`)}
            </DescriptionItem>
            <DescriptionItem term={t("lists.versions.drawer.by")}>
              {by ? <AvatarItem name={by} size="sm" /> : t("lists.common.system")}
            </DescriptionItem>
            <DescriptionItem term={t("lists.versions.drawer.when")}>
              {formatDateTime(event.at, locale, { timeStyle: "medium" })}
            </DescriptionItem>
            <DescriptionItem term={t("lists.versions.drawer.from")}>
              <span className="authz-two">
                <span className="authz-mono">{event.ip || "—"}</span>
                {event.browser ? <small>{event.browser}</small> : null}
              </span>
            </DescriptionItem>
          </DescriptionList>

          <section className="authz-drawer-section">
            <div className="authz-drawer-head">
              <Heading level={3} size="title-sm">
                {t("lists.versions.drawer.whatChanged")}
              </Heading>
            </div>
            <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
              {version.change === "deleted"
                ? t("lists.versions.drawer.deleted")
                : !version.previous
                  ? t("lists.versions.drawer.first")
                  : changes.length === 0
                    ? t("lists.versions.drawer.same")
                    : t("lists.versions.drawer.kept")}
            </Text>
            {version.previous && version.change !== "deleted" && changes.length ? (
              <Table
                label={t("lists.versions.drawer.whatChanged")}
                rows={changes}
                rowId={(c) => c.field}
                rowLabel={(c) => c.field}
                columns={[
                  {
                    id: "field",
                    header: t("lists.versions.drawer.field"),
                    width: 110,
                    cell: (c) => t(`lists.versions.drawer.fields.${c.field}`),
                  },
                  {
                    id: "before",
                    header: t("lists.versions.drawer.before"),
                    cell: (c) => show(c.before),
                  },
                  {
                    id: "after",
                    header: t("lists.versions.drawer.after"),
                    cell: (c) => show(c.after),
                  },
                ]}
              />
            ) : null}
          </section>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose render={<Button variant="ghost">{t("lists.common.close")}</Button>} />
        {version.current ? (
          <Button variant="soft" render={<Link to="/authorization/abac" />}>
            {t("lists.versions.drawer.openAbac")}
          </Button>
        ) : null}
      </DrawerFooter>
    </DrawerContent>
  );
}
