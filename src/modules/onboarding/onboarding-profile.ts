// Segmentation captured at org creation (use case, team size, role), stored on the tenant as
// `metadata.onboarding` to tailor the first-run checklist. It is stashed in localStorage at submit
// and applied on the first dashboard load, so free and paid sign-ups behave alike.

export interface OnboardingProfile {
  use_case?: string;
  team_size?: string;
  role?: string;
  logo_url?: string; // applied on first load for paid plans; free plans send it on create
}

export const USE_CASES: { value: string; label: string }[] = [
  { value: "b2b_saas", label: "B2B SaaS (customers log into my product)" },
  { value: "consumer", label: "Consumer app (sign-ups & social login)" },
  { value: "internal", label: "Internal tools (employees & SSO)" },
  { value: "api_platform", label: "API platform (machine-to-machine)" },
  { value: "other", label: "Something else" },
];

export const ROLES: { value: string; label: string }[] = [
  { value: "founder", label: "Founder / exec" },
  { value: "engineer", label: "Engineer" },
  { value: "product", label: "Product / design" },
  { value: "security", label: "Security / IT" },
  { value: "other", label: "Other" },
];

/** Checklist step ids per use case, most relevant first; unlisted steps follow in default order. */
export const CHECKLIST_ORDER: Record<string, string[]> = {
  b2b_saas: ["oauth-app", "invite", "branding", "webhook", "api-key"],
  consumer: ["oauth-app", "branding", "invite", "api-key", "webhook"],
  internal: ["invite", "oauth-app", "branding", "webhook", "api-key"],
  api_platform: ["api-key", "oauth-app", "webhook", "invite", "branding"],
};

/** A use-case-specific nudge shown atop the checklist. */
export const CHECKLIST_INTRO: Record<string, string> = {
  b2b_saas: "Get customers signing into your product — register your app first.",
  consumer: "Wire up sign-in and make it yours — start with your app and branding.",
  internal: "Bring your team in and connect your identity provider.",
  api_platform: "Set up machine-to-machine access — start with an API key.",
};

const STASH_KEY = "qeetid-pending-onboarding";
const STASH_TTL_MS = 24 * 60 * 60 * 1000; // an abandoned checkout's profile expires

/** A profile waiting for the organization it was entered for, which may not exist yet. */
export interface PendingOnboarding {
  profile: OnboardingProfile;
  slug: string; // the organization it belongs to
  userId: string; // the person who entered it
  stashedAt: number;
}

export function stashOnboardingProfile(pending: Omit<PendingOnboarding, "stashedAt">) {
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify({ ...pending, stashedAt: Date.now() }));
  } catch {
    // Storage disabled (private mode): tailoring is a nice-to-have, so skip it.
  }
}

/** Returns the profile `userId` stashed for a new organization, or null; drops an expired one. */
export function readPendingOnboarding(userId: string | null): PendingOnboarding | null {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingOnboarding>;
    const valid =
      !!pending.profile &&
      typeof pending.slug === "string" &&
      typeof pending.userId === "string" &&
      typeof pending.stashedAt === "number" &&
      Date.now() - pending.stashedAt < STASH_TTL_MS;
    if (!valid) {
      localStorage.removeItem(STASH_KEY);
      return null;
    }
    return pending.userId === userId ? (pending as PendingOnboarding) : null;
  } catch {
    return null;
  }
}

export function clearStashedProfile() {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    // best-effort
  }
}
