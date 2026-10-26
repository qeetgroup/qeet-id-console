import { CheckIcon, MonitorIcon, MoonIcon, QeetLogo, SunIcon } from "@qeetrix/icons";
import { Google, Microsoft } from "@thesvg/react";
import {
  IconButton,
  Link,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SkipLink,
} from "@qeetrix/react";
import { useTheme } from "@qeetrix/ui";
import { Link as RouterLink } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
import { Trans, useTranslation } from "react-i18next";

import { OFFERED_LANGUAGES } from "@/i18n";
import { DOCS_URL, PRIVACY_URL, TERMS_URL, SECURITY_URL } from "@/platform/config/site-urls";
import { useIsDark } from "@/platform/theme/use-is-dark";

// With only English offered there is nothing to pick, so the picker and its Select load only once
// a second language is.
const LanguagePicker = lazy(() =>
  import("./language-picker").then((m) => ({ default: m.LanguagePicker })),
);

/**
 * The frame of every entry page (sign in, sign up, verify email, forgot and reset password), on
 * @qeetrix/react: the form column on the start side, `panel` on the end side, which small screens
 * drop. Comfortable density, as the design rules give every welcoming page.
 */
export function EntryShell({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  const { t } = useTranslation("auth-flow");

  return (
    <div className="entry" data-qx-density="comfortable">
      <div className="entry-side">
        <SkipLink href="#entry-content">{t("layout.skipToForm")}</SkipLink>
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
            {t("entry.help")}
          </Link>
        </header>

        <main id="entry-content" className="entry-main" tabIndex={-1}>
          {children}
        </main>

        <footer className="entry-foot" data-qx-density="compact">
          <nav aria-label={t("layout.legalNavigation")}>
            <Link href={TERMS_URL} tone="subtle" external>
              {t("entry.legal.terms")}
            </Link>
            <Link href={PRIVACY_URL} tone="subtle" external>
              {t("entry.legal.privacy")}
            </Link>
            <Link href={SECURITY_URL} tone="subtle" external>
              {t("entry.legal.trust")}
            </Link>
          </nav>
          <div className="entry-foot-end">
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

/** The consent line under a form, with the real legal links. */
export function EntryConsent({ action }: { action: "signIn" | "signUp" }) {
  return (
    <p className="entry-consent">
      <Trans
        ns="auth-flow"
        i18nKey={action === "signUp" ? "entry.consent.signUp" : "entry.consent.signIn"}
        components={{
          terms: <Link href={TERMS_URL} external />,
          privacy: <Link href={PRIVACY_URL} external />,
        }}
      />
    </p>
  );
}

/** Opens the two most common inboxes, beside a step that waits for an email. */
export function EntryInboxLinks() {
  const { t } = useTranslation("auth-flow");
  return (
    <nav className="entry-providers" aria-label={t("entry.inbox.group")}>
      <a
        className="entry-provider"
        href="https://mail.google.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Google aria-hidden="true" />
        {t("entry.inbox.gmail")}
      </a>
      <a
        className="entry-provider"
        href="https://outlook.office.com/mail"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Microsoft aria-hidden="true" />
        {t("entry.inbox.outlook")}
      </a>
    </nav>
  );
}

/** The "or" between the main path and the alternatives. */
export function EntryOr() {
  const { t } = useTranslation("auth-flow");
  return <div className="entry-or">{t("entry.or")}</div>;
}

type Theme = "light" | "dark" | "system";

/**
 * Light, dark or the system's, in a menu: each choice with its icon, the current one checked. The
 * same choice, and the same storage, as the console's toggle. To move into @qeetrix/react as a
 * ThemeSwitcher.
 */
function ThemeMenu() {
  const { t } = useTranslation("common");
  const { theme, setTheme } = useTheme();
  const isDark = useIsDark();
  const options: { value: Theme; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: t("themeToggle.light"), icon: SunIcon },
    { value: "dark", label: t("themeToggle.dark"), icon: MoonIcon },
    { value: "system", label: t("themeToggle.system"), icon: MonitorIcon },
  ];

  return (
    <Menu>
      <MenuTrigger
        render={
          <IconButton
            variant="ghost"
            tone="neutral"
            icon={theme === "system" ? MonitorIcon : isDark ? MoonIcon : SunIcon}
            aria-label={t("themeToggle.toggleTheme")}
          />
        }
      />
      <MenuContent align="end" className="entry-theme-menu">
        {options.map((option) => {
          const current = theme === option.value;
          return (
            <MenuItem
              key={option.value}
              icon={option.icon}
              aria-current={current ? "true" : undefined}
              shortcut={current ? <CheckIcon shape="sharp" size={16} /> : undefined}
              onClick={() => setTheme(option.value)}
            >
              {option.label}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
