// Segmentation captured during org creation ("what are you building / team size
// / your role"). Stored on the tenant as `metadata.onboarding` and used to
// tailor the first-run checklist and invite copy. It's stashed in localStorage
// at submit time and applied to the org's metadata on the first dashboard load
// (uniform for free — created inline — and paid — provisioned post-checkout).

export interface OnboardingProfile {
  use_case?: string;
  team_size?: string;
  role?: string;
}

export const USE_CASES: { value: string; label: string }[] = [
  { value: "b2b_saas", label: "B2B SaaS (customers log into my product)" },
  { value: "consumer", label: "Consumer app (sign-ups & social login)" },
  { value: "internal", label: "Internal tools (employees & SSO)" },
  { value: "api_platform", label: "API platform (machine-to-machine)" },
  { value: "other", label: "Something else" },
];

export const TEAM_SIZES: { value: string; label: string }[] = [
  { value: "solo", label: "Just me" },
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "200+", label: "200+" },
];

export const ROLES: { value: string; label: string }[] = [
  { value: "founder", label: "Founder / exec" },
  { value: "engineer", label: "Engineer" },
  { value: "product", label: "Product / design" },
  { value: "security", label: "Security / IT" },
  { value: "other", label: "Other" },
];

// Per use-case ordering of the first-run checklist step ids, most-relevant
// first. Steps not listed keep their default order after the listed ones.
export const CHECKLIST_ORDER: Record<string, string[]> = {
  b2b_saas: ["oauth-app", "invite", "branding", "webhook", "api-key"],
  consumer: ["oauth-app", "branding", "invite", "api-key", "webhook"],
  internal: ["invite", "oauth-app", "branding", "webhook", "api-key"],
  api_platform: ["api-key", "oauth-app", "webhook", "invite", "branding"],
};

// A short, use-case-specific nudge shown atop the checklist.
export const CHECKLIST_INTRO: Record<string, string> = {
  b2b_saas: "Get customers signing into your product — register your app first.",
  consumer: "Wire up sign-in and make it yours — start with your app and branding.",
  internal: "Bring your team in and connect your identity provider.",
  api_platform: "Set up machine-to-machine access — start with an API key.",
};

const STASH_KEY = "qeetid-pending-onboarding";

export function stashOnboardingProfile(p: OnboardingProfile) {
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(p));
  } catch {
    // localStorage disabled (private mode) — segmentation tailoring is a
    // nice-to-have, so silently skip persistence.
  }
}

export function readStashedProfile(): OnboardingProfile | null {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    return raw ? (JSON.parse(raw) as OnboardingProfile) : null;
  } catch {
    return null;
  }
}

export function clearStashedProfile() {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    // ignore
  }
}
