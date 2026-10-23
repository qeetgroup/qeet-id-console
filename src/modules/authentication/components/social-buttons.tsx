import { Button } from "@qeetrix/ui";
import { Apple, Github, Google, Microsoft } from "@thesvg/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { socialStartUrl, usePlatformSocialProviders } from "../api/flows";

import { AuthDivider } from "./auth-form-card";

// Platform social providers the console can show. A button renders only when the server reports
// the provider as configured, never as a disabled placeholder.
const CATALOG: { id: string; label: string; icon: ReactNode }[] = [
  { id: "google", label: "Google", icon: <Google /> },
  { id: "github", label: "GitHub", icon: <Github className="dark:invert" /> },
  { id: "microsoft", label: "Microsoft", icon: <Microsoft /> },
  { id: "apple", label: "Apple", icon: <Apple className="invert dark:invert-0" /> },
];

/**
 * Renders the "Or continue with" divider and one button per configured social provider, or
 * nothing when none is configured, so the forms show only what works.
 */
export function SocialButtons({
  verb = "Continue",
  intent = "login",
  disabled = false,
}: {
  verb?: string;
  disabled?: boolean;
  intent?: "login" | "signup"; // "signup" may create an account; "login" requires an existing one
}) {
  const { t } = useTranslation("auth-flow");
  const q = usePlatformSocialProviders();
  const configured = q.data?.providers ?? [];
  const items = CATALOG.filter((p) => configured.includes(p.id));
  if (items.length === 0) return null;

  return (
    <>
      <AuthDivider>{t("form.socialDivider")}</AuthDivider>
      <div className="auth-social-grid">
        {items.map((p) => (
          <Button
            key={p.id}
            className="auth-social-button"
            variant="outline"
            type="button"
            disabled={disabled}
            aria-label={t("form.socialLabel", { verb, provider: p.label })}
            onClick={() => {
              window.location.href = socialStartUrl(p.id, intent);
            }}
          >
            <span aria-hidden="true">{p.icon}</span>
            <span>{p.label}</span>
          </Button>
        ))}
      </div>
    </>
  );
}
