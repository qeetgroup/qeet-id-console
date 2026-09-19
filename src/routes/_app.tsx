import { SidebarProvider } from "@qeetrix/ui";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { useFeatureFlag } from "@/platform/feature-flags/provider";
import { CapabilityProvider, useCapabilities } from "@/platform/security/capability-provider";
import { AccessBoundary } from "@/platform/security/access-boundary";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { AppSidebar } from "@/modules/dashboard/components/app-sidebar";
import { CommandPaletteLauncher } from "@/modules/dashboard/components/command-palette-launcher";
import { ConsoleHeader } from "@/modules/dashboard/components/console-header";
import { ImpersonationBanner } from "@/modules/dashboard/components/impersonation-banner";
import { ShortcutsDialog } from "@/modules/dashboard/components/shortcuts-dialog";
import { VerifyEmailBanner } from "@/modules/dashboard/components/verify-email-banner";
import { QeetAILauncher, QeetAIRuntimeProvider, QeetAIWorkspace } from "@/modules/qeetai";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { organizationSelectionBlocksPath } from "@/platform/auth/organization-selection";
import { useIdleLogout } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { getServerSession } from "@/platform/api/server-proxy";
import { useGlobalShortcuts } from "@/shared/hooks/use-shortcuts";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    // An unverified account is held on /verify-email rather than admitted to
    // the console. Guarding here (not in the signup component) is what makes it
    // survive a refresh, a deep link and the back button.
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
          // Two-pane sidebar: 4rem icon rail + 15rem section panel — wide
          // enough for the longest nav labels and the tenant switcher without
          // truncating. Collapsed state falls back to just the rail
          // (--sidebar-width-icon).
          "--sidebar-width": "19rem",
          "--sidebar-width-icon": "4rem",
        } as React.CSSProperties
      }
    >
      {/* Skip link: first focusable element, visually hidden until focused so
          keyboard users can jump straight past the sidebar/header to content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring focus:outline-none"
      >
        Skip to main content
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
      {qeetaiEnabled ? (
        <QeetAIRuntimeProvider>
          {/* Docked mode renders as an in-flow flex sibling here, so opening the
              QeetAI reflows the organization instead of covering it. */}
          <QeetAIWorkspace />
          <QeetAILauncher />
        </QeetAIRuntimeProvider>
      ) : null}
      <CommandPaletteLauncher open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </SidebarProvider>
  );
}
