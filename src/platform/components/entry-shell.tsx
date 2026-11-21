import { QeetLogo } from "@qeetrix/icons";
import { Link, SkipLink } from "@qeetrix/react";
import { ThemeSwitcher } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { OFFERED_LANGUAGES } from "@/i18n";
import { DOCS_URL, PRIVACY_URL, SECURITY_URL, TERMS_URL } from "@/platform/config/site-urls";

// With only English offered there is nothing to pick, so the picker and its Select load only once
// a second language is.
const LanguagePicker = lazy(() =>
  import("./language-picker").then((m) => ({ default: m.LanguagePicker })),
);

/**
 * The frame of every page outside the console (signing in and up, verifying an email, choosing or
 * creating an organisation), on @qeetrix/react: the form column on the start side, `panel` on the
 * end side, which small screens drop. Comfortable density, as the design rules give every
 * welcoming page. Without a panel the page is one wide column (creating an organisation), and
 * `note` goes in the foot.
 */
export function EntryShell({
  children,
  panel,
  note,
}: {
  children: ReactNode;
  panel?: ReactNode;
  note?: ReactNode;
}) {
  const { t } = useTranslation("common");

  return (
    <div className="entry" data-qx-density="comfortable" data-wide={panel ? undefined : ""}>
      <div className="entry-side">
        <SkipLink href="#entry-content">{t("skipToContent")}</SkipLink>
        <header className="entry-top">
          <RouterLink to="/sign-in" className="entry-brand" aria-label="Qeet ID">
            <span className="entry-logo-light" aria-hidden="true">
              <QeetLogo height={28} alt="" />
            </span>
            <span className="entry-logo-dark" aria-hidden="true">
              <QeetLogo height={28} variant="dark" alt="" />
            </span>
            <span className="entry-brand-rule" aria-hidden="true" />
            <span aria-hidden="true">Qeet ID</span>
          </RouterLink>
          <Link href={DOCS_URL} tone="subtle" external>
            {t("entryFrame.help")}
          </Link>
        </header>

        <main id="entry-content" className="entry-main" tabIndex={-1}>
          {children}
        </main>

        <footer className="entry-foot" data-qx-density="compact">
          <nav aria-label={t("entryFrame.legalNavigation")}>
            <Link href={TERMS_URL} tone="subtle" external>
              {t("entryFrame.terms")}
            </Link>
            <Link href={PRIVACY_URL} tone="subtle" external>
              {t("entryFrame.privacy")}
            </Link>
            <Link href={SECURITY_URL} tone="subtle" external>
              {t("entryFrame.trust")}
            </Link>
          </nav>
          <div className="entry-foot-end">
            {note}
            {OFFERED_LANGUAGES.length > 1 && (
              <Suspense fallback={null}>
                <LanguagePicker />
              </Suspense>
            )}
            <ThemeMenu />
          </div>
        </footer>
      </div>
      {panel}
    </div>
  );
}

/** Light, dark or the system's (Qeetrix's ThemeSwitcher), in the console's words. */
function ThemeMenu() {
  const { t } = useTranslation("common");
  return (
    <ThemeSwitcher
      menuSide="top"
      messages={{
        label: t("themeToggle.toggleTheme"),
        light: t("themeToggle.light"),
        dark: t("themeToggle.dark"),
        system: t("themeToggle.system"),
      }}
    />
  );
}
