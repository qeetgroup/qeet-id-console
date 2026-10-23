import { cn } from "@qeetrix/ui";
import { ShieldCheckIcon, UserRoundIcon, UsersRoundIcon } from "@qeetrix/icons";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

// Each slot names its copy: `hero.features.<slot>` and, signing up, `hero.signup.*.<slot>`.
const FEATURES = [
  { slot: "first", Icon: UserRoundIcon },
  { slot: "second", Icon: ShieldCheckIcon },
  { slot: "third", Icon: UsersRoundIcon },
] as const;

export function BrandHero({
  intent = "signin",
  className,
  ...props
}: ComponentProps<"aside"> & { intent?: "signin" | "signup" }) {
  const { t } = useTranslation("auth-flow");
  const isSignup = intent === "signup";

  return (
    <aside className={cn("auth-hero", className)} {...props}>
      <p className="auth-eyebrow">{t("hero.eyebrow")}</p>
      <h2 className="auth-hero-title">
        <span className={isSignup ? "auth-copy-light" : undefined}>
          {t("hero.titleLine1")}
          <br />
          {t("hero.titleLine2")}
        </span>
        {isSignup && (
          <span className="auth-copy-dark">
            {t("hero.signup.titleLine1")}
            <br />
            {t("hero.signup.titleLine2")}
            <br />
            {t("hero.signup.titleLine3")}
          </span>
        )}
      </h2>
      <p className="auth-hero-description">
        <span className={isSignup ? "auth-copy-light" : undefined}>
          {t(isSignup ? "hero.signup.lightDescription" : "hero.description")}
        </span>
        {isSignup && <span className="auth-copy-dark">{t("hero.signup.description")}</span>}
      </p>
      <ul className="auth-features">
        {FEATURES.map(({ slot, Icon }) => (
          <li key={slot} className="auth-feature">
            <Icon className="auth-feature-icon" strokeWidth={1.8} aria-hidden="true" />
            <div className={isSignup ? "auth-copy-light" : undefined}>
              <h3>{t(`hero.features.${slot}.title`)}</h3>
              <p>
                {t(
                  isSignup
                    ? `hero.signup.lightFeatures.${slot}`
                    : `hero.features.${slot}.description`,
                )}
              </p>
            </div>
            {isSignup && (
              <div className="auth-copy-dark">
                <h3>{t(`hero.signup.features.${slot}.title`)}</h3>
                <p>{t(`hero.signup.features.${slot}.description`)}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
