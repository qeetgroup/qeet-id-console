import { useTranslation } from "react-i18next";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useTheme,
} from "@qeetrix/ui";
import { MonitorIcon, MoonIcon, SunIcon } from "@qeetrix/icons";

export function ThemeToggle() {
  const { t } = useTranslation("common");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("themeToggle.toggleTheme")}>
            <SunIcon className="size-[1.1rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute size-[1.1rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-36">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon />
          {t("themeToggle.light")}
          {theme === "light" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon />
          {t("themeToggle.dark")}
          {theme === "dark" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <MonitorIcon />
          {t("themeToggle.system")}
          {theme === "system" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
