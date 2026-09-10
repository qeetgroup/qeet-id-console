import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { AuthBackground } from "./auth-background";

const TERMS_URL = "https://id.qeet.in/legal/terms";
const PRIVACY_URL = "https://id.qeet.in/legal/privacy";

export function AuthShell({
  children,
  intent,
}: {
  children: ReactNode;
  intent?: "signin" | "signup";
}) {
  const { t } = useTranslation("auth-flow");

  return (
    <div className="auth-shell" data-auth-intent={intent}>
      <a className="auth-skip-link" href="#auth-content">
        {t("layout.skipToForm")}
      </a>
      <div className="auth-stage">
        <AuthBackground />
        <header className="auth-header">
          <Link to="/sign-in" className="auth-logo" aria-label="Qeet ID">
            <img
              src="/qeet-logo-on-light.svg"
              className="auth-copy-light"
              width="28"
              height="36"
              alt=""
            />
            <img
              src="/qeet-logo-on-dark.svg"
              className="auth-copy-dark"
              width="28"
              height="36"
              alt=""
            />
            <span>Qeet ID</span>
          </Link>
          <nav className="auth-navigation" aria-label={t("layout.navigation")}>
            <a href="https://id.qeet.in/security" target="_blank" rel="noopener noreferrer">
              {t("layout.security")}
            </a>
            <a href="https://id.qeet.in/pricing" target="_blank" rel="noopener noreferrer">
              {t("layout.business")}
            </a>
            <a href="https://docs.id.qeet.in" target="_blank" rel="noopener noreferrer">
              {t("layout.help")}
            </a>
          </nav>
        </header>
        <main id="auth-content" className="auth-content" tabIndex={-1}>
          {children}
        </main>
        <p className="auth-brand-caption" aria-hidden="true">
          {t("layout.simpleAccess")}
          <br />
          {t("layout.strongerTogether")}
        </p>
      </div>
      <footer className="auth-footer">
        <nav aria-label={t("layout.legalNavigation")}>
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            {t("layout.terms")}
          </a>
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {t("layout.privacy")}
          </a>
          <a href="https://id.qeet.in/security" target="_blank" rel="noopener noreferrer">
            {t("layout.trust")}
          </a>
        </nav>
        {intent && (
          <p className="auth-consent">
            <Trans
              ns="auth-flow"
              i18nKey={intent === "signup" ? "layout.signupConsent" : "layout.signinConsent"}
              components={{
                terms: (
                  <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                    {t("layout.terms")}
                  </a>
                ),
                privacy: (
                  <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                    {t("layout.privacy")}
                  </a>
                ),
              }}
            />
          </p>
        )}
        <p className="auth-footer-tagline">{t("layout.tagline")}</p>
      </footer>
    </div>
  );
}
