import { QeetLogo } from "@qeetrix/icons";
import { TopBar, TopBarSearch } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { QeetAITrigger } from "@/modules/qeetai";
import { useTenantId } from "@/platform/auth/session";
import { AccountMenu } from "./account-menu";
import { ScopeName } from "./scope-name";

/**
 * The console's top bar: Qeet ID, the organisation's name, search (⌘K) in the centre, Qeet AI, and
 * the account menu. The shell adds the triggers of its panels (Notifications, Help). Without an
 * organisation there is nothing to search or ask about: Qeet ID and the account menu only.
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
  const hasOrg = !!useTenantId();
  return (
    <TopBar
      logo={<QeetLogo variant="dark" height={20} alt="" />}
      product={t("frame.product")}
      href="/"
      render={<Link to="/" />}
      context={hasOrg ? <ScopeName /> : undefined}
      search={
        hasOrg && (
          <TopBarSearch
            placeholder={t("frame.search")}
            shortcut={["⌘", "K"]}
            aria-keyshortcuts="Meta+K Control+K"
            disabled={!searchAvailable}
            title={searchAvailable ? undefined : t("frame.searchUnavailable")}
            onClick={onSearch}
          />
        )
      }
      actions={hasOrg && <QeetAITrigger />}
      account={<AccountMenu onShortcuts={onShortcuts} />}
    />
  );
}
