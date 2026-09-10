import { ArrowRightAlt, RefreshArrow } from "@qeetrix/icons";
import { Button, cn } from "@qeetrix/ui";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function AuthFormCard({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("auth-form-card", className)} {...props}>
      <span className="auth-card-orb" aria-hidden="true" />
      {children}
    </div>
  );
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return <div className="auth-divider">{children}</div>;
}

export function PasskeyButton({
  isLoading,
  ...props
}: ComponentProps<typeof Button> & { isLoading?: boolean }) {
  const { t } = useTranslation("auth-flow");

  return (
    <Button type="button" variant="outline" className="auth-passkey-button" {...props}>
      {isLoading ? (
        <RefreshArrow className="animate-spin" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <circle cx="9" cy="6.5" r="4" />
          <path d="M9 12c-4.4 0-7 2.6-7 6v2h11v-4.5A5.8 5.8 0 0 1 14 12.9 11.5 11.5 0 0 0 9 12Z" />
          <path d="M18 10a4 4 0 0 0-1.5 7.7V22h3v-2H21v-2h-1.5v-.3A4 4 0 0 0 18 10Zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      )}
      <span>{t(isLoading ? "passkey.waiting" : "passkey.button")}</span>
      {!isLoading && <ArrowRightAlt className="auth-passkey-chevron" aria-hidden="true" />}
    </Button>
  );
}
