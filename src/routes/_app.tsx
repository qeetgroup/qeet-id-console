import { SidebarProvider } from "@qeetrix/ui";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFeatureFlag } from "@/platform/feature-flags/provider";
import { CapabilityProvider, useCapabilities } from "@/platform/security/capability-provider";
import { AccessBoundary } from "@/platform/security/access-boundary";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { AppSidebar } from "@/modules/dashboard";
import { CommandPaletteLauncher } from "@/modules/dashboard";
import { ConsoleHeader } from "@/modules/dashboard";
import { ImpersonationBanner } from "@/modules/dashboard";
import { ShortcutsDialog } from "@/modules/dashboard";
import { VerifyEmailBanner } from "@/modules/dashboard";
import { QeetAI } from "@/modules/qeetai";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { organizationSelectionBlocksPath } from "@/platform/auth/organization-selection";
import { useIdleLogout } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { getServerSession } from "@/platform/api/server-proxy";
import { useGlobalShortcuts } from "@/platform/keyboard/shortcuts";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    // Guarding here, not in the sign-up flow, holds an unverified account on /verify-email across
    // a refresh, a deep link and the back button.
    if (!(await hasVerifiedEmail(context.queryClient, session.userId))) {
      throw redirect({ to: "/verify-email" });
    }
    if (organizationSelectionBlocksPath(session.organizationSelectionRequired, location.pathname)) {
      throw redirect({ to: "/select-organization", replace: true });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();

  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);

  return (
    <CapabilityProvider>
      <SensitiveActionProvider>
        <ConsoleFrame />
      </SensitiveActionProvider>
    </CapabilityProvider>
  );
}

function ConsoleFrame() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const access = useCapabilities();
  const qeetaiEnabled = useFeatureFlag("qeetai");
  useIdleLogout(IDLE_TIMEOUT_MS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useGlobalShortcuts({
    onHelp: useCallback(() => setShortcutsOpen(true), []),
    navigate: useCallback((path: string) => navigate({ to: path }), [navigate]),
    canNavigate: access.canAccessPath,
  });

  return (
    <SidebarProvider
      className="console-shell"
      style={
        {
          // A 4rem icon rail plus a 15rem panel, wide enough for the longest labels and the tenant
          // switcher; collapsed, only the rail shows.
          "--sidebar-width": "19rem",
          "--sidebar-width-icon": "4rem",
        } as React.CSSProperties
      }
    >
      {/* Hidden until focused, so keyboard users can skip past the navigation. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring focus:outline-none"
      >
        {t("skipToContent")}
      </a>
      <AppSidebar />
      <div className="console-workspace">
        <ImpersonationBanner />
        <VerifyEmailBanner />
        <ConsoleHeader
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          searchAvailable={access.state === "ready"}
        />
        <main id="main-content" tabIndex={-1} className="console-content focus:outline-none">
          <AccessBoundary>
            <Outlet />
          </AccessBoundary>
        </main>
      </div>
      {qeetaiEnabled ? <QeetAI /> : null}
      <CommandPaletteLauncher open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </SidebarProvider>
  );
}
