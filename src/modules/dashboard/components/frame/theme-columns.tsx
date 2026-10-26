import { Menu as BaseMenu } from "@base-ui/react/menu";
import { MonitorIcon, MoonIcon, SunIcon } from "@qeetrix/icons";
import { useTheme } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

type Theme = "light" | "dark" | "system";

const THEMES = [
  { value: "light", label: "frame.themeLight", icon: SunIcon },
  { value: "dark", label: "frame.themeDark", icon: MoonIcon },
  { value: "system", label: "frame.themeSystem", icon: MonitorIcon },
] as const;

/**
 * Light, dark or the system's, as three columns inside the account menu: menu radio items (arrow
 * keys, Enter, "radio, checked"), drawn like ThemeSwitcher's segmented toggles, with no dot. The
 * menu stays open, so the change shows at once. The same choice and storage as the theme provider.
 */
export function ThemeColumns() {
  const { t } = useTranslation("dashboard");
  const { theme, setTheme } = useTheme();
  return (
    <BaseMenu.RadioGroup
      value={theme}
      onValueChange={(value) => setTheme(value as Theme)}
      className="frame-theme"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <BaseMenu.RadioItem
          key={value}
          value={value}
          className="frame-theme-option"
          closeOnClick={false}
        >
          <Icon shape="sharp" size={16} aria-hidden="true" />
          <span>{t(label)}</span>
        </BaseMenu.RadioItem>
      ))}
    </BaseMenu.RadioGroup>
  );
}
