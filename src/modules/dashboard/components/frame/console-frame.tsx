import { BellIcon, CircleQuestionMarkIcon } from "@qeetrix/icons";
import { AppShell, type AppShellDrawer } from "@qeetrix/react/experimental";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { QEETAI_DRAWER, QeetAI, useQeetAIDrawer } from "@/modules/qeetai";
import { scopedStorage } from "@/platform/auth/scoped-storage";
import { useOrganizationId } from "@/platform/auth/session";
import { useFeatureFlag } from "@/platform/feature-flags/provider";
import { useGlobalShortcuts } from "@/platform/keyboard/shortcuts";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CommandPaletteLauncher } from "../command-palette-launcher";
import { ShortcutsDialog } from "../shortcuts-dialog";
import { ConsoleSidebar } from "./console-sidebar";
import { ConsoleTopBar } from "./console-top-bar";
import { HelpPanel } from "./help-panel";
import { NotificationsPanel, useHasUnreadNotifications } from "./notifications-panel";

// Whether the navigation is the icon rail, per person and organisation.
const collapsedPreference = scopedStorage("qeetid.sidebar-collapsed");

/**
 * The console's frame on @qeetrix/react: the top bar, the navigation, the Notifications and Help
 * panels, search (⌘K) and the keyboard shortcuts. Each page draws its own header (PageHeader, with
 * PageBreadcrumb and PageTabList from page-place.tsx).
 */
export function ConsoleFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const access = useCapabilities();
  // Without an organisation only My account is open: no panels, no Qeet AI.
  const hasOrg = !!useOrganizationId();
  const qeetaiEnabled = useFeatureFlag("qeetai") && hasOrg;
  const hasUnread = useHasUnreadNotifications(hasOrg);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  // Qeet AI is one of the frame's panels; whether it's open lives in its own store (⌘J, "Ask").
  const qeetai = useQeetAIDrawer(qeetaiEnabled);
  // Opening Qeet AI another way closes the frame's own panel, so it doesn't come back after.
  useEffect(() => {
    if (qeetai.open) setPanel(null);
  }, [qeetai.open]);
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

  const drawers: AppShellDrawer[] = !hasOrg
    ? []
    : [
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
        ...(qeetai.drawer ? [qeetai.drawer] : []),
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
        activeDrawer={qeetai.open ? QEETAI_DRAWER : panel}
        onActiveDrawerChange={(id) => {
          qeetai.setOpen(id === QEETAI_DRAWER);
          setPanel(id === QEETAI_DRAWER ? null : id);
        }}
        sidebarCollapsed={collapsed}
        onSidebarCollapsedChange={(next) => {
          setCollapsed(next);
          collapsedPreference.write(next);
        }}
        mainId="main-content"
      >
        {children}
      </AppShell>
      {qeetaiEnabled ? <QeetAI /> : null}
      <CommandPaletteLauncher open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
