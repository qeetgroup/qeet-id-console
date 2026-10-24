import { ThemeProvider } from "@qeetrix/ui";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { Toaster } from "sonner";

import { publicConfigScript } from "@/platform/config/api-base-url";

import type { RouterContext } from "@/platform/query/query-client";
import { queryDevtoolsPlugin } from "@/platform/query/query-devtools";

import appCss from "../styles.css?url";
import i18n from "@/i18n";

const THEME_STORAGE_KEY = "qeetid-admin-theme";
const DEVTOOLS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === "true";

// Runs while <head> parses and puts the saved (or system) theme class on <html>, so the first
// paint is right; ThemeProvider alone would apply it after hydration, with a visible flash.
const themeFlashScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var t=localStorage.getItem(k);if(t!=="dark"&&t!=="light"&&t!=="system")t="system";var resolved=t==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var h=document.documentElement;h.classList.remove("light","dark");h.classList.add(resolved);h.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: i18n.t("common:pageTitle.console") },
      {
        name: "description",
        content: i18n.t("common:pageTitle.description"),
      },
      { name: "theme-color", content: "#f5f7fa", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#11141a", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Theme-adaptive favicon, with the .ico as the universal fallback.
      {
        rel: "icon",
        href: "/qeet-logo-on-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/qeet-logo-on-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Server-rendered with the request's CSP nonce; each runs once and removes itself. */}
        <ScriptOnce>{themeFlashScript}</ScriptOnce>
        <ScriptOnce>{publicConfigScript()}</ScriptOnce>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="system" storageKey={THEME_STORAGE_KEY}>
          {children}
          <Toaster position="bottom-right" closeButton richColors />
          {DEVTOOLS_ENABLED ? (
            <TanStackDevtools
              config={{ position: "bottom-right" }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
                queryDevtoolsPlugin,
              ]}
            />
          ) : null}
        </ThemeProvider>
        <HydrationMarker />
        <Scripts />
      </body>
    </html>
  );
}

// Marks <html data-hydrated> once React owns the document: input typed before hydration is
// discarded, so browser tests wait for this marker.
function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}
