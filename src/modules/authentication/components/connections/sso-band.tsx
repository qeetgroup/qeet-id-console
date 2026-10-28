// The SSO list's toolbar and its key numbers (sso-list-page.tsx).
import { formatNumber, Select } from "@qeetrix/react";
import { SearchField } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  CONNECTION_GROUPS,
  type ConnectionListFilters,
  type ConnectionRow,
  KIND_GROUP,
} from "@/modules/authentication/connections-model";

const ANY = "";

/** Search, then the kind, in one row; each kind with its count (until QTRX-20). */
export function SsoToolbar({
  filters,
  onFiltersChange,
  counts,
}: {
  filters: ConnectionListFilters;
  onFiltersChange: (next: ConnectionListFilters) => void;
  counts: Record<(typeof CONNECTION_GROUPS)[number], number>;
}) {
  const { t } = useTranslation("connections");
  const n = (value: number) => formatNumber(value, formatLocale());
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  return (
    <div className="ppl-toolbar">
      <div className="ppl-filters">
        <SearchField
          className="ppl-search"
          aria-label={t("list.search")}
          placeholder={t("list.searchPlaceholder")}
          value={text}
          onValueChange={setText}
          onSearch={(q) => onFiltersChange({ ...filters, q: q.trim() || undefined })}
        />
        <Select<string>
          aria-label={t("list.columns.kind")}
          className="ppl-filter"
          value={filters.type ?? ANY}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              type: (value || undefined) as ConnectionListFilters["type"],
            })
          }
          items={[
            { value: ANY, label: t("list.anyKind") },
            ...CONNECTION_GROUPS.map((group) => ({
              value: group,
              label: `${t(`list.groups.${group}`)} · ${n(counts[group])}`,
            })),
          ]}
        />
      </div>
    </div>
  );
}

/**
 * The SSO list's key numbers: the SAML connections people sign in through, the SAML apps Qeet ID
 * signs them in to (each on, and in setup, by the server's own state), and what needs a look; each
 * a way into the list.
 */
export function SsoBand({ rows, links }: { rows: ConnectionRow[]; links: number }) {
  const { t } = useTranslation("connections");
  const n = (value: number) => formatNumber(value, formatLocale());
  const of = (group: (typeof CONNECTION_GROUPS)[number]) =>
    rows.filter((r) => KIND_GROUP[r.kind] === group);
  const signIn = of("signin");
  const apps = of("apps");
  const on = (list: ConnectionRow[]) => list.filter((r) => r.on).length;
  const setup = (list: ConnectionRow[]) => list.filter((r) => r.draft).length;
  const attention = rows.filter((r) => r.status === "attention").length;
  const inSetup = rows.filter((r) => r.status === "setup").length;

  return (
    <dl className="ppl-band is-three">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.signIn")}</dt>
        <dd className="ppl-value">{n(signIn.length)}</dd>
        <dd className="ppl-note">
          {t("band.onSetup", { on: n(on(signIn)), setup: n(setup(signIn)) })}
        </dd>
        {signIn.length ? (
          <dd className="ppl-link">
            <Link to="/auth/connections/saml" search={{ type: "signin" }}>
              {t("band.showSignIn")}
            </Link>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.apps")}</dt>
        <dd className="ppl-value">{n(apps.length)}</dd>
        <dd className="ppl-note">
          {t("band.onSetup", { on: n(on(apps)), setup: n(setup(apps)) })}
        </dd>
        {apps.length ? (
          <dd className="ppl-link">
            <Link to="/auth/connections/saml" search={{ type: "apps" }}>
              {t("band.showApps")}
            </Link>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            <li className={attention ? undefined : "is-zero"}>
              <Link to="/auth/connections/saml" search={{ show: "attention" }}>
                <span>{t("band.looks.attention")}</span>
                <b className={attention ? "is-warning" : undefined}>{n(attention)}</b>
              </Link>
            </li>
            <li className={inSetup ? undefined : "is-zero"}>
              <Link to="/auth/connections/saml" search={{ show: "setup" }}>
                <span>{t("band.looks.setup")}</span>
                <b>{n(inSetup)}</b>
              </Link>
            </li>
            <li className={links ? undefined : "is-zero"}>
              <Link to="/auth/connections/saml" hash="setup-links">
                <span>{t("band.looks.links")}</span>
                <b>{n(links)}</b>
              </Link>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  );
}
