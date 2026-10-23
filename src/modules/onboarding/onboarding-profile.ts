// Segmentation captured at org creation (use case, team size, role), stored on the tenant as
// `metadata.onboarding` to tailor the first-run checklist. It is stashed in localStorage at submit
// and applied on the first dashboard load, so free and paid sign-ups behave alike.

import type { TranslationKey } from "@/i18n";

export interface OnboardingProfile {
  use_case?: string;
  team_size?: string;
  role?: string;
  logo_url?: string; // applied on first load for paid plans; free plans send it on create
}

// Option labels are catalogue keys.
export const USE_CASES: { value: string; label: TranslationKey }[] = [
  { value: "b2b_saas", label: "onboarding:setup.profile.useCases.b2bSaas" },
  { value: "consumer", label: "onboarding:setup.profile.useCases.consumer" },
  { value: "internal", label: "onboarding:setup.profile.useCases.internal" },
  { value: "api_platform", label: "onboarding:setup.profile.useCases.apiPlatform" },
  { value: "other", label: "onboarding:setup.profile.useCases.other" },
];

export const ROLES: { value: string; label: TranslationKey }[] = [
  { value: "founder", label: "onboarding:setup.profile.roles.founder" },
  { value: "engineer", label: "onboarding:setup.profile.roles.engineer" },
  { value: "product", label: "onboarding:setup.profile.roles.product" },
  { value: "security", label: "onboarding:setup.profile.roles.security" },
  { value: "other", label: "onboarding:setup.profile.roles.other" },
];

/** Checklist step ids per use case, most relevant first; unlisted steps follow in default order. */
export const CHECKLIST_ORDER: Record<string, string[]> = {
  b2b_saas: ["oauth-app", "invite", "branding", "webhook", "api-key"],
  consumer: ["oauth-app", "branding", "invite", "api-key", "webhook"],
  internal: ["invite", "oauth-app", "branding", "webhook", "api-key"],
  api_platform: ["api-key", "oauth-app", "webhook", "invite", "branding"],
};

/** The catalogue key of a use-case-specific nudge shown atop the checklist. */
export const CHECKLIST_INTRO: Record<string, TranslationKey> = {
  b2b_saas: "onboarding:setup.checklistIntro.b2bSaas",
  consumer: "onboarding:setup.checklistIntro.consumer",
  internal: "onboarding:setup.checklistIntro.internal",
  api_platform: "onboarding:setup.checklistIntro.apiPlatform",
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
