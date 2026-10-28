import { QeetrixProvider } from "@qeetrix/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";

import { publicConfigScript } from "@/platform/config/api-base-url";

import type { RouterContext } from "@/platform/query/query-client";
import { queryDevtoolsPlugin } from "@/platform/query/query-devtools";
import {
  colorSchemeFlashScript,
  saveColorScheme,
  savedColorScheme,
} from "@/platform/theme/color-scheme";

import appCss from "../styles.css?url";
import i18n from "@/i18n";

const DEVTOOLS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEVTOOLS === "true";

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
        <ScriptOnce>{colorSchemeFlashScript}</ScriptOnce>
        <ScriptOnce>{publicConfigScript()}</ScriptOnce>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ConsoleProvider>
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
        </ConsoleProvider>
        <HydrationMarker />
        <Scripts />
      </body>
    </html>
  );
}

// Wraps the app in @qeetrix/react's provider: it owns the colour scheme (light, dark or the
// system's, kept on this device) and formats in the console's language.
function ConsoleProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState(savedColorScheme);
  const { i18n: i18next } = useTranslation();
  const language = i18next.resolvedLanguage ?? "en";
  return (
    <QeetrixProvider
      colorScheme={colorScheme}
      onColorSchemeChange={(next) => {
        setColorScheme(next);
        saveColorScheme(next);
      }}
      locale={language === "en" ? "en-IN" : language === "hi" ? "hi-IN" : language}
    >
      {children}
    </QeetrixProvider>
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
