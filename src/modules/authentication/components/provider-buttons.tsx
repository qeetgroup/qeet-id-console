import { Alert } from "@qeetrix/react/experimental";
import { Apple, Github, Google, Microsoft } from "@thesvg/react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { socialStartUrl, usePlatformSocialProviders } from "../api/flows";

type Provider = { id: string; label: string; logo: ReactNode };

// Google, Microsoft and Apple always show, so the page looks the same whatever the server has set
// up; GitHub joins them once configured. The logos are the providers' own artwork.
const ALWAYS: Provider[] = [
  {
    id: "apple",
    label: "Apple",
    logo: (
      <span data-invert="light">
        <Apple aria-hidden="true" />
      </span>
    ),
  },
  { id: "google", label: "Google", logo: <Google aria-hidden="true" /> },
  { id: "microsoft", label: "Microsoft", logo: <Microsoft aria-hidden="true" /> },
];
const WHEN_CONFIGURED: Provider[] = [
  {
    id: "github",
    label: "GitHub",
    logo: (
      <span data-invert="dark">
        <Github aria-hidden="true" />
      </span>
    ),
  },
];

// One whole phrase per action, so no sentence is assembled from a verb and a provider name.
const ACTION_LABEL = {
  signIn: "form.socialSignIn",
  signUp: "form.socialSignUp",
} as const;

/**
 * The social providers as one ruled row. A provider the server hasn't configured still shows; its
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
      <fieldset
        className="entry-providers"
        aria-label={t(
          action === "signUp" ? "entry.providers.signUpGroup" : "entry.providers.signInGroup",
        )}
      >
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            className="entry-provider"
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
            {provider.logo}
            <span>{provider.label}</span>
          </button>
        ))}
      </fieldset>
    </>
  );
}
