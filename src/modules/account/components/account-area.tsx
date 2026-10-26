import {
  DatabaseIcon,
  MonitorSmartphoneIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "@qeetrix/icons";
import { PageHeader } from "@qeetrix/react/experimental";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const PAGES = [
  { to: "/account/profile", key: "profile", icon: UserRoundIcon },
  { to: "/account/security", key: "security", icon: ShieldCheckIcon },
  { to: "/account/sessions", key: "sessions", icon: MonitorSmartphoneIcon },
  { to: "/account/data", key: "data", icon: DatabaseIcon },
] as const;

/**
 * My account, inside the console: its header, its four pages in a column (as Emails lists its
 * templates), and the chosen page beside them. The same for everyone, with or without an
 * organisation.
 */
export function AccountArea({ children }: { children: ReactNode }) {
  const { t } = useTranslation("account");
  const { pathname } = useLocation();
  return (
    <>
      <PageHeader title={t("area.title")} description={t("area.description")} />
      <div className="account-layout">
        <nav aria-label={t("area.title")}>
          <ul className="account-subnav">
            {PAGES.map((page) => (
              <li key={page.to}>
                <Link to={page.to} aria-current={pathname === page.to ? "page" : undefined}>
                  <span className="account-icon" aria-hidden="true">
                    <page.icon />
                  </span>
                  <span>
                    <strong>{t(`area.pages.${page.key}.label`)}</strong>
                    <small>{t(`area.pages.${page.key}.line`)}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="account-body">{children}</div>
      </div>
    </>
  );
}
