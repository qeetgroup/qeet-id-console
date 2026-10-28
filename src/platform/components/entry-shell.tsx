import { CheckIcon, MonitorIcon, MoonIcon, QeetLogo, SunIcon } from "@qeetrix/icons";
import {
  type ColorScheme,
  IconButton,
  Link,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SkipLink,
  useColorScheme,
} from "@qeetrix/react";
import { Link as RouterLink } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { OFFERED_LANGUAGES } from "@/i18n";
import { DOCS_URL, PRIVACY_URL, SECURITY_URL, TERMS_URL } from "@/platform/config/site-urls";
import { useIsDark } from "@/platform/theme/use-is-dark";

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

/**
 * Light, dark or the system's, in a menu: each choice with its icon, the current one checked. The
 * same choice, and the same storage, as the console's account menu. To move into @qeetrix/react
 * as a ThemeSwitcher.
 */
function ThemeMenu() {
  const { t } = useTranslation("common");
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = useIsDark();
  const options: { value: ColorScheme; label: string; icon: typeof SunIcon }[] = [
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
            icon={colorScheme === "system" ? MonitorIcon : isDark ? MoonIcon : SunIcon}
            aria-label={t("themeToggle.toggleTheme")}
          />
        }
      />
      <MenuContent align="end" className="entry-theme-menu">
        {options.map((option) => {
          const current = colorScheme === option.value;
          return (
            <MenuItem
              key={option.value}
              icon={option.icon}
              aria-current={current ? "true" : undefined}
              shortcut={current ? <CheckIcon shape="sharp" size={16} /> : undefined}
              onClick={() => setColorScheme(option.value)}
            >
              {option.label}
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
