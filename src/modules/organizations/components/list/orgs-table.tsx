import { ArrowLeftRightIcon } from "@qeetrix/icons";
import {
  Avatar,
  Badge,
  Button,
  formatDate,
  formatDateTime,
  formatNumber,
  Meter,
  type TableColumn,
  Text,
  VisuallyHidden,
} from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useOrgLabels } from "@/modules/organizations/components/org-labels";
import {
  type OrgReading,
  type OrgRow,
  roleOf,
  twoStepShare,
} from "@/modules/organizations/orgs-model";

const DAY = 86_400_000;

/** When you last opened it, in words: "Now" for the one you're in, then days, then a date. */
function useOpened() {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  return (row: OrgRow, now: number): string => {
    if (row.current) return t("list.opened.now");
    if (!row.lastUsedAt) return t("list.opened.never");
    const days = Math.floor((now - Date.parse(row.lastUsedAt)) / DAY);
    if (days < 1) return t("list.opened.today");
    if (days === 1) return t("list.opened.yesterday");
    if (days < 7) return t("list.opened.daysAgo", { n: days });
    // A short date that doesn't wrap: "21 Oct"; with its year past about ten months.
    return days > 300
      ? formatDate(row.lastUsedAt, locale, { dateStyle: "medium" })
      : new Date(row.lastUsedAt).toLocaleDateString(locale, { day: "numeric", month: "short" });
  };
}

/**
 * The list's columns: the organisation (its logo, name and domain or URL, and what's true of it
 * now: current, suspended, being deleted), your role, members, two-step against the target, plan,
 * when you last opened it, and Switch. A suspended one has no Switch (no one can sign in to it).
 */
export function useOrgColumns({
  reading,
  switching,
  onSwitch,
}: {
  reading: OrgReading;
  /** The organisation being switched to, if any. */
  switching: string | null;
  onSwitch: (row: OrgRow) => void;
}): TableColumn<OrgRow>[] {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const names = useOrgLabels();
  const opened = useOpened();

  return [
    {
      id: "name",
      header: t("list.columns.organisation"),
      sortable: true,
      primary: true,
      cell: (row) => (
        <span className="org-cell">
          <Avatar name={row.name} src={row.logo_url || undefined} shape="square" decorative />
          <span className="org-two">
            <span className="org-name-line">
              <Link className="org-name" to="/organizations/$orgId" params={{ orgId: row.id }}>
                {row.name}
              </Link>
              {row.current ? (
                <Badge tone="brand" size="sm">
                  {t("list.row.current")}
                </Badge>
              ) : null}
              {row.status === "suspended" ? (
                <Badge tone="warning" size="sm">
                  {t("list.row.suspended")}
                </Badge>
              ) : null}
              {row.deletion_due_at ? (
                <Badge tone="warning" size="sm">
                  {t("list.row.deleting", {
                    date: formatDate(row.deletion_due_at, locale, { dateStyle: "medium" }),
                  })}
                </Badge>
              ) : null}
            </span>
            <small>{row.domain || row.slug}</small>
          </span>
        </span>
      ),
    },
    {
      id: "role",
      header: t("list.columns.role"),
      width: 130,
      cell: (row) => roleOf(row) ?? <Text tone="subtle">{t("list.row.noRole")}</Text>,
    },
    {
      id: "members",
      header: t("list.columns.members"),
      numeric: true,
      sortable: true,
      sortFirst: "descending",
      width: 110,
      cell: (row) => n(row.member_count ?? 0),
    },
    {
      id: "twostep",
      header: t("list.columns.twoStep"),
      sortable: true,
      sortFirst: "descending",
      width: 170,
      cell: (row) => {
        const share = twoStepShare(row);
        return (
          <span className="org-meter">
            <Meter
              value={share}
              tone={share < reading.target ? "warning" : "success"}
              aria-label={t("list.row.twoStepLabel", { name: row.name, n: share })}
            />
            <span className="org-meter-n" aria-hidden="true">
              {t("list.band.percent", { n: share })}
            </span>
          </span>
        );
      },
    },
    { id: "plan", header: t("list.columns.plan"), width: 110, cell: (row) => names.plan(row.plan) },
    {
      id: "opened",
      header: t("list.columns.opened"),
      sortable: true,
      sortFirst: "descending",
      width: 130,
      cell: (row) =>
        row.lastUsedAt && !row.current ? (
          <time
            dateTime={row.lastUsedAt}
            title={formatDateTime(row.lastUsedAt, locale, { dateStyle: "long" })}
          >
            {opened(row, reading.now)}
          </time>
        ) : (
          <Text tone="subtle">{opened(row, reading.now)}</Text>
        ),
    },
    {
      id: "switch",
      header: <VisuallyHidden>{t("list.columns.switch")}</VisuallyHidden>,
      align: "end",
      width: 112,
      cell: (row) =>
        row.current || row.status !== "active" ? null : (
          <Button
            variant="ghost"
            tone="neutral"
            size="sm"
            icon={ArrowLeftRightIcon}
            loading={switching === row.id}
            disabled={!!switching && switching !== row.id}
            aria-label={t("list.row.switchTo", { name: row.name })}
            onClick={() => onSwitch(row)}
          >
            {t("list.row.switch")}
          </Button>
        ),
    },
  ];
}
