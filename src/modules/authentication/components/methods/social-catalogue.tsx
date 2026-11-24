// The social providers the console knows: their own logos and, where the provider publishes one at
// a fixed address, the OpenID Connect discovery URL to fill in. An organisation's providers sign in
// through OpenID Connect only (qeet-id-server, social.UpsertProvider refuses one without a public
// https discovery URL), so a provider that doesn't offer it can't be added at all.

import { QeetLogo } from "@qeetrix/icons";
import type { ReactNode } from "react";

import { BrandLogo } from "@/shared/components/brand-logo";

export type SocialProviderId =
  | "google"
  | "microsoft"
  | "apple"
  | "linkedin"
  | "gitlab"
  | "slack"
  | "twitch"
  | "qeet"
  | "github"
  | "facebook"
  | "x"
  | "discord";

export type SocialProviderMeta = {
  id: SocialProviderId;
  label: string;
  /** Filled in for providers with one fixed, tenant-independent discovery document. */
  discovery: string;
};

// In the order they're offered: the ones whose discovery URL is known first.
export const SOCIAL_PROVIDERS: readonly SocialProviderMeta[] = [
  {
    id: "google",
    label: "Google",
    discovery: "https://accounts.google.com/.well-known/openid-configuration",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    discovery: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
  },
  {
    id: "apple",
    label: "Apple",
    discovery: "https://appleid.apple.com/.well-known/openid-configuration",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    discovery: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
  },
  {
    id: "gitlab",
    label: "GitLab",
    discovery: "https://gitlab.com/.well-known/openid-configuration",
  },
  { id: "slack", label: "Slack", discovery: "https://slack.com/.well-known/openid-configuration" },
  {
    id: "twitch",
    label: "Twitch",
    discovery: "https://id.twitch.tv/oauth2/.well-known/openid-configuration",
  },
  { id: "qeet", label: "Qeet", discovery: "" },
  { id: "github", label: "GitHub", discovery: "" },
  { id: "facebook", label: "Facebook", discovery: "" },
  { id: "x", label: "X (Twitter)", discovery: "" },
  { id: "discord", label: "Discord", discovery: "" },
];

/** The providers that can't be added: they don't offer OpenID Connect sign-in. */
export const NOT_OIDC = ["Bitbucket", "Spotify", "Reddit"] as const;

export function findSocialProvider(id: string): SocialProviderMeta | undefined {
  return SOCIAL_PROVIDERS.find((p) => p.id === id);
}

/**
 * A provider's own mark (a third-party logo, its brand's artwork from public/brand), for a row's
 * icon box. Monochrome marks are inverted where they'd vanish, as on My account (`data-invert`, styled
 * by account.css); Qeet's own logo has a file per theme.
 */
export function ProviderMark({ id }: { id: string }): ReactNode {
  switch (id) {
    case "google":
    case "microsoft":
    case "linkedin":
    case "gitlab":
    case "slack":
    case "twitch":
    case "facebook":
    case "discord":
      return <BrandLogo name={id} />;
    case "apple":
      return <BrandLogo name="apple" invert="light" />;
    case "github":
    case "x":
      return <BrandLogo name={id} invert="dark" />;
    case "qeet":
      return (
        <span className="am-mark">
          <span className="entry-logo-light">
            <QeetLogo height={16} alt="" />
          </span>
          <span className="entry-logo-dark">
            <QeetLogo height={16} variant="dark" alt="" />
          </span>
        </span>
      );
    default:
      return null;
  }
}
