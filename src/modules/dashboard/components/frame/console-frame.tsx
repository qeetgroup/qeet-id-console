import { BellIcon, CircleQuestionMarkIcon } from "@qeetrix/icons";
import { AppShell, type AppShellDrawer } from "@qeetrix/react/experimental";
import { useMatches, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { QeetAI } from "@/modules/qeetai";
import { scopedStorage } from "@/platform/auth/scoped-storage";
import { useFeatureFlag } from "@/platform/feature-flags/provider";
import { useGlobalShortcuts } from "@/platform/keyboard/shortcuts";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CommandPaletteLauncher } from "../command-palette-launcher";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { ConsoleSidebar } from "./console-sidebar";
import { ConsoleTopBar } from "./console-top-bar";
import { HelpPanel } from "./help-panel";
import { NotificationsPanel, useHasUnreadNotifications } from "./notifications-panel";
import { PageNav } from "./page-nav";

// Whether the navigation is the icon rail, per person and organisation.
const collapsedPreference = scopedStorage("qeetid.sidebar-collapsed");

/**
 * The console's frame on @qeetrix/react: the top bar, the navigation, the Notifications and Help
 * panels, search (⌘K) and the keyboard shortcuts. A page not yet rebuilt gets the breadcrumb and
 * its sub-page tabs above it, and keeps its old spacing.
 */
export function ConsoleFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const access = useCapabilities();
  const qeetaiEnabled = useFeatureFlag("qeetai");
  const hasUnread = useHasUnreadNotifications();
  const ownHeader = useMatches({
    select: (matches) => matches.some((m) => m.staticData?.pageHeader),
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  // Read after hydration, so the server's expanded navigation and the first client render agree.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(collapsedPreference.read() === true), []);

  const openShortcuts = useCallback(() => {
    setPanel(null);
    setShortcutsOpen(true);
  }, []);
  useGlobalShortcuts({
    onHelp: openShortcuts,
    navigate: useCallback((path: string) => navigate({ to: path }), [navigate]),
    canNavigate: access.canAccessPath,
  });

  const drawers: AppShellDrawer[] = [
    {
      id: "notifications",
      label: t("frame.notifications.title"),
      icon: BellIcon,
      badge: hasUnread,
      content: <NotificationsPanel />,
    },
    {
      id: "help",
      label: t("frame.help.title"),
      icon: CircleQuestionMarkIcon,
      content: <HelpPanel onShortcuts={openShortcuts} />,
    },
  ];

  return (
    <>
      <AppShell
        topBar={
          <ConsoleTopBar
            searchAvailable={access.state === "ready"}
            onSearch={() => setPaletteOpen(true)}
            onShortcuts={openShortcuts}
          />
        }
        sidebar={<ConsoleSidebar />}
        drawers={drawers}
        activeDrawer={panel}
        onActiveDrawerChange={setPanel}
        sidebarCollapsed={collapsed}
        onSidebarCollapsedChange={(next) => {
          setCollapsed(next);
          collapsedPreference.write(next);
        }}
        mainId="main-content"
      >
        <PageNav />
        {ownHeader ? children : <div className="console-legacy console-content">{children}</div>}
      </AppShell>
      {qeetaiEnabled ? <QeetAI /> : null}
      <CommandPaletteLauncher open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
