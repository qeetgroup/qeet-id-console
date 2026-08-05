import { Button, cn, Field, FieldSeparator } from "@qeetrix/ui";
import { Apple, Github, Google, Microsoft } from "@thesvg/react";
import type { ReactNode } from "react";

import { socialStartUrl, usePlatformSocialProviders } from "@/lib/auth";

// Display catalog for the platform social providers. A button is rendered ONLY
// when the backend reports the provider as configured (its keys are set) — see
// usePlatformSocialProviders → GET /v1/social/platform/providers. Nothing is
// shown as a disabled placeholder.
const CATALOG: { id: string; label: string; icon: ReactNode }[] = [
  { id: "google", label: "Google", icon: <Google /> },
  { id: "microsoft", label: "Microsoft", icon: <Microsoft /> },
  { id: "github", label: "GitHub", icon: <Github className="dark:invert" /> },
  { id: "apple", label: "Apple", icon: <Apple className="invert dark:invert-0" /> },
];

// Static classes so Tailwind can see them (no dynamic string interpolation).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * The "Or continue with" divider + one button per configured social provider.
 * Renders nothing at all when no providers are configured, so the auth forms
 * show only what actually works.
 */
export function SocialButtons({
  verb = "Continue",
  intent = "login",
}: {
  verb?: string;
  // "signup" permits just-in-time account creation; "login" (default) requires
  // an existing account.
  intent?: "login" | "signup";
}) {
  const q = usePlatformSocialProviders();
  const configured = q.data?.providers ?? [];
  const items = CATALOG.filter((p) => configured.includes(p.id));
  if (items.length === 0) return null;

  return (
    <>
      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        Or continue with
      </FieldSeparator>
      <Field className={cn("grid gap-4", GRID_COLS[Math.min(items.length, 5)] ?? "grid-cols-4")}>
        {items.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            type="button"
            onClick={() => {
              window.location.href = socialStartUrl(p.id, intent);
            }}
          >
            {p.icon}
            <span className="sr-only">
              {verb} with {p.label}
            </span>
          </Button>
        ))}
      </Field>
    </>
  );
}
