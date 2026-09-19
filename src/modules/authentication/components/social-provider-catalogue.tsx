// The social-provider catalogue: logos, dark-mode icon handling and the
// discovery URL we can pre-fill. This is presentation, not data — the tenant's
// saved credentials come from `api/social.ts`.
//
// Only providers we actually surface in the console live here. The backend
// (`domains/federation/social/social.go`) requires a `discovery_url` on every
// provider unconditionally — there is no plain-OAuth-2.0 fallback path
// (QID-03) — so a blank `discovery` here means the admin has to supply that URL
// themselves before sign-in will work. `support` follows the product comps:
// GitHub, Facebook, X and Discord stay configurable even though they publish no
// discovery document of their own.

import { cn } from "@qeetrix/ui";
import {
  Apple,
  Bitbucket,
  Discord,
  Facebook,
  Github,
  Gitlab,
  Google,
  Linkedin,
  Microsoft,
  Reddit,
  Slack,
  Spotify,
  Twitch,
  X,
} from "@thesvg/react";

/**
 * `first-party` is Qeet's own IdP, `supported` can be configured today, and
 * `unsupported` needs a custom OIDC discovery configuration Qeet ID can't work
 * with yet, so its card stays read-only.
 */
export type SocialProviderSupport = "first-party" | "supported" | "unsupported";

export type SocialProviderMeta = {
  id: string;
  label: string;
  /** Either a @thesvg icon component, or a pair of theme-aware logo srcs (Qeet). */
  Icon?: typeof Google;
  logoLight?: string;
  logoDark?: string;
  /**
   * Dark-mode legibility: black-only marks (GitHub, X) invert in dark,
   * white-only marks (Apple) invert in light.
   */
  iconClass: string;
  /** Set only for icons that ship without a baked colour, so they take currentColor. */
  fill?: string;
  /** Pre-filled for providers with a stable, tenant-independent well-known endpoint. */
  discovery: string;
  support: SocialProviderSupport;
};

export const SOCIAL_PROVIDERS: SocialProviderMeta[] = [
  {
    id: "qeet",
    label: "Qeet",
    logoLight: "/qeet-logo-on-light.svg",
    logoDark: "/qeet-logo-on-dark.svg",
    iconClass: "",
    discovery: "",
    support: "first-party",
  },
  {
    id: "google",
    label: "Google",
    Icon: Google,
    iconClass: "",
    discovery: "https://accounts.google.com/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "github",
    label: "GitHub",
    Icon: Github,
    iconClass: "dark:invert",
    discovery: "",
    support: "supported",
  },
  {
    id: "microsoft",
    label: "Microsoft",
    Icon: Microsoft,
    iconClass: "",
    discovery: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "apple",
    label: "Apple",
    Icon: Apple,
    iconClass: "invert dark:invert-0",
    discovery: "https://appleid.apple.com/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: Facebook,
    iconClass: "text-[#1877F2]",
    fill: "currentColor",
    discovery: "",
    support: "supported",
  },
  {
    id: "x",
    label: "X (Twitter)",
    Icon: X,
    iconClass: "dark:invert",
    discovery: "",
    support: "supported",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    iconClass: "",
    discovery: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "gitlab",
    label: "GitLab",
    Icon: Gitlab,
    iconClass: "",
    discovery: "https://gitlab.com/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "bitbucket",
    label: "Bitbucket",
    Icon: Bitbucket,
    iconClass: "",
    discovery: "",
    support: "unsupported",
  },
  {
    id: "discord",
    label: "Discord",
    Icon: Discord,
    iconClass: "",
    discovery: "",
    support: "supported",
  },
  {
    id: "slack",
    label: "Slack",
    Icon: Slack,
    iconClass: "",
    discovery: "https://slack.com/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "twitch",
    label: "Twitch",
    Icon: Twitch,
    iconClass: "",
    discovery: "https://id.twitch.tv/oauth2/.well-known/openid-configuration",
    support: "supported",
  },
  {
    id: "spotify",
    label: "Spotify",
    Icon: Spotify,
    iconClass: "",
    discovery: "",
    support: "unsupported",
  },
  {
    id: "reddit",
    label: "Reddit",
    Icon: Reddit,
    iconClass: "",
    discovery: "",
    support: "unsupported",
  },
];

export function findSocialProvider(id: string): SocialProviderMeta | undefined {
  return SOCIAL_PROVIDERS.find((p) => p.id === id);
}

const MARK_SIZES = {
  sm: { box: "size-9", glyph: "size-7", radius: "rounded-xl" },
  lg: { box: "size-14", glyph: "size-10", radius: "rounded-2xl" },
} as const;

/**
 * The provider logo. Qeet ships as a full-bleed app icon (its own background,
 * theme-swapped like the favicons in `__root.tsx`); vendor marks render bare,
 * the way each brand's guidelines expect.
 */
export function SocialProviderMark({
  provider,
  size = "sm",
  className,
}: {
  provider: SocialProviderMeta;
  size?: keyof typeof MARK_SIZES;
  className?: string;
}) {
  const s = MARK_SIZES[size];

  if (provider.logoLight) {
    return (
      <span className={cn(s.box, s.radius, "shrink-0 overflow-hidden border", className)}>
        <img src={provider.logoLight} alt="" className="size-full object-cover dark:hidden" />
        <img src={provider.logoDark} alt="" className="hidden size-full object-cover dark:block" />
      </span>
    );
  }

  const Icon = provider.Icon;
  return (
    <span className={cn(s.box, "flex shrink-0 items-center justify-center", className)}>
      {Icon && (
        <Icon
          className={cn(s.glyph, provider.iconClass)}
          {...(provider.fill ? { fill: provider.fill } : {})}
        />
      )}
    </span>
  );
}
