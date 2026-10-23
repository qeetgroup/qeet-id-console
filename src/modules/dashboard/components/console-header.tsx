import { useTranslation } from "react-i18next";
import { Button, Separator, SidebarTrigger } from "@qeetrix/ui";
import { KeyboardIcon, SearchIcon } from "@qeetrix/icons";

import { QeetAITrigger } from "@/modules/qeetai";
import { ThemeToggle } from "@/platform/components/theme-toggle";

import { DynamicBreadcrumb } from "./dynamic-breadcrumb";
import { HeaderUser } from "./header-user";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationsInbox } from "./notifications-inbox";

type ConsoleHeaderProps = {
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  searchAvailable: boolean;
};

/** Persistent operator chrome shared by every admin route. */
export function ConsoleHeader({
  onOpenPalette,
  onOpenShortcuts,
  searchAvailable,
}: ConsoleHeaderProps) {
  const { t } = useTranslation("dashboard");
  return (
    <header className="console-topbar">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ms-1" />
        <Separator orientation="vertical" className="mx-1 hidden h-5 lg:block" />
        <DynamicBreadcrumb />
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="console-command-trigger"
        aria-label={t(
          searchAvailable
            ? "consoleHeader.searchTheControlPlane"
            : "consoleHeader.searchUnavailable",
        )}
        disabled={!searchAvailable}
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t("consoleHeader.searchTheControlPlane")}</span>
        <kbd className="console-keycap">⌘ + K</kbd>
      </button>

      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t("common:actions.search")}
          onClick={onOpenPalette}
          disabled={!searchAvailable}
        >
          <SearchIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden 2xl:inline-flex"
          aria-label={t("consoleHeader.keyboardShortcuts")}
          title={t("consoleHeader.keyboardShortcuts2")}
          onClick={onOpenShortcuts}
        >
          <KeyboardIcon />
        </Button>
        <QeetAITrigger />
        <NotificationsInbox />
        <div className="hidden xl:block">
          <LanguageSwitcher />
        </div>
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1.5 hidden h-6 sm:block" />
        <HeaderUser />
      </div>
    </header>
  );
}
