import { Tooltip } from "@qeetrix/react";
import {
  Alert,
  ProviderButton,
  ProviderButtonGroup,
  type ProviderLogoInvert,
} from "@qeetrix/react/experimental";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { socialStartUrl, usePlatformSocialProviders } from "../api/flows";

import { BrandLogo } from "@/shared/components/brand-logo";

type Provider = { id: string; label: string; logo: ReactNode; invert?: ProviderLogoInvert };

// Google, Microsoft and Apple always show, so the page looks the same whatever the server has set
// up; GitHub joins them once configured. The logos are the providers' own artwork.
const ALWAYS: Provider[] = [
  { id: "apple", label: "Apple", logo: <BrandLogo name="apple" />, invert: "light" },
  { id: "google", label: "Google", logo: <BrandLogo name="google" /> },
  { id: "microsoft", label: "Microsoft", logo: <BrandLogo name="microsoft" /> },
];
const WHEN_CONFIGURED: Provider[] = [
  { id: "github", label: "GitHub", logo: <BrandLogo name="github" />, invert: "dark" },
];

// Up to three providers show their names; four don't fit the 400px column without cutting a
// name short, so past three the row shows the logos alone.
const MAX_NAMED = 3;

// One whole phrase per action, so no sentence is assembled from a verb and a provider name.
const ACTION_LABEL = {
  signIn: "form.socialSignIn",
  signUp: "form.socialSignUp",
} as const;

/**
 * The social providers as one ruled row (Qeetrix's ProviderButtonGroup). A provider the server hasn't configured still shows; its
 * button explains that it isn't available yet instead of sending the person to a broken page.
 *
 * Past three providers the row shows logos only (entry.css): each button is still named in full
 * ("Sign in with GitHub"), and a tooltip says it to anyone pointing at or tabbing to a logo.
 * ProviderButtonGroup has no logos-only mode yet; that's raised with Qeetrix, and this goes when it
 * has one.
 */
export function ProviderButtons({
  action,
  disabled = false,
}: {
  action: keyof typeof ACTION_LABEL;
  disabled?: boolean;
}) {
  const { t } = useTranslation("auth-flow");
  const query = usePlatformSocialProviders();
  const configured = query.data?.providers ?? [];
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const providers = [...ALWAYS, ...WHEN_CONFIGURED.filter((p) => configured.includes(p.id))];
  // "signup" may create an account; "login" requires an existing one.
  const intent = action === "signUp" ? "signup" : "login";
  const logosOnly = providers.length > MAX_NAMED;

  return (
    <>
      {unavailable && (
        <Alert
          tone="info"
          title={t("entry.providers.unavailableTitle", { provider: unavailable })}
          onDismiss={() => setUnavailable(null)}
        >
          {t("entry.providers.unavailableText")}
        </Alert>
      )}
      <ProviderButtonGroup
        className="entry-providers"
        data-logos-only={logosOnly || undefined}
        aria-label={t(
          action === "signUp" ? "entry.providers.signUpGroup" : "entry.providers.signInGroup",
        )}
      >
        {providers.map((provider) => {
          const name = t(ACTION_LABEL[action], { provider: provider.label });
          const button = (
            <ProviderButton
              key={provider.id}
              logo={provider.logo}
              logoInvert={provider.invert}
              disabled={disabled}
              aria-label={name}
              onClick={() => {
                if (configured.includes(provider.id)) {
                  window.location.href = socialStartUrl(provider.id, intent);
                } else if (!query.isPending) {
                  setUnavailable(provider.label);
                }
              }}
            >
              {provider.label}
            </ProviderButton>
          );
          // The tooltip repeats the button's name, so it isn't read twice.
          return logosOnly ? (
            <Tooltip key={provider.id} content={name}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </ProviderButtonGroup>
    </>
  );
}
