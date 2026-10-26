import { QeetLogo } from "@qeetrix/icons";
import { TopBar, TopBarSearch } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { QeetAITrigger } from "@/modules/qeetai";
import { AccountMenu } from "./account-menu";
import { ScopeName } from "./scope-name";

/**
 * The console's top bar: Qeet ID, the organisation's name, search (⌘K) in the centre, Qeet AI, and
 * the account menu. The shell adds the triggers of its panels (Notifications, Help).
 */
export function ConsoleTopBar({
  searchAvailable,
  onSearch,
  onShortcuts,
}: {
  searchAvailable: boolean;
  onSearch: () => void;
  onShortcuts: () => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <TopBar
      logo={<QeetLogo variant="dark" height={20} alt="" />}
      product={t("frame.product")}
      href="/"
      render={<Link to="/" />}
      context={<ScopeName />}
      search={
        <TopBarSearch
          placeholder={t("frame.search")}
          shortcut={["⌘", "K"]}
          aria-keyshortcuts="Meta+K Control+K"
          disabled={!searchAvailable}
          title={searchAvailable ? undefined : t("frame.searchUnavailable")}
          onClick={onSearch}
        />
      }
      actions={<QeetAITrigger />}
      account={<AccountMenu onShortcuts={onShortcuts} />}
    />
  );
}
