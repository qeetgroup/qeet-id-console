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

// One whole phrase per action, so no sentence is assembled from a verb and a provider name.
const ACTION_LABEL = {
  signIn: "form.socialSignIn",
  signUp: "form.socialSignUp",
} as const;

/**
 * The social providers as one ruled row (Qeetrix's ProviderButtonGroup). A provider the server hasn't configured still shows; its
 * button explains that it isn't available yet instead of sending the person to a broken page.
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
        aria-label={t(
          action === "signUp" ? "entry.providers.signUpGroup" : "entry.providers.signInGroup",
        )}
      >
        {providers.map((provider) => (
          <ProviderButton
            key={provider.id}
            logo={provider.logo}
            logoInvert={provider.invert}
            disabled={disabled}
            aria-label={t(ACTION_LABEL[action], { provider: provider.label })}
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
        ))}
      </ProviderButtonGroup>
    </>
  );
}
