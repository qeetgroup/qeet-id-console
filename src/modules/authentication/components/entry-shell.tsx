import { Google, Microsoft } from "@thesvg/react";
import { Avatar, Link, Text } from "@qeetrix/react";
import { Trans, useTranslation } from "react-i18next";

import type { Me } from "@/platform/auth/session";
import { PRIVACY_URL, TERMS_URL } from "@/platform/config/site-urls";
import { organizationImage } from "../organization-selection-model";

// The frame lives in platform, as onboarding's create-organisation page uses it too.
export { EntryShell } from "@/platform/components/entry-shell";

/** The consent line under a form, with the real legal links. */
export function EntryConsent({ action }: { action: "signIn" | "signUp" }) {
  return (
    <p className="entry-consent">
      <Trans
        ns="auth-flow"
        i18nKey={action === "signUp" ? "entry.consent.signUp" : "entry.consent.signIn"}
        components={{
          terms: <Link href={TERMS_URL} external />,
          privacy: <Link href={PRIVACY_URL} external />,
        }}
      />
    </p>
  );
}

/** Opens the two most common inboxes, beside a step that waits for an email. */
export function EntryInboxLinks() {
  const { t } = useTranslation("auth-flow");
  return (
    <nav className="entry-providers" aria-label={t("entry.inbox.group")}>
      <a
        className="entry-provider"
        href="https://mail.google.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Google aria-hidden="true" />
        {t("entry.inbox.gmail")}
      </a>
      <a
        className="entry-provider"
        href="https://outlook.office.com/mail"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Microsoft aria-hidden="true" />
        {t("entry.inbox.outlook")}
      </a>
    </nav>
  );
}

/** Who is signed in, with the way out: above a choice made as that account. */
export function EntryAccount({
  user,
  disabled,
  onSignOut,
}: {
  user: Pick<Me, "email" | "display_name" | "avatar_url">;
  disabled?: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  const name = user.display_name?.trim() || user.email;
  return (
    <div className="entry-account">
      <Avatar name={name} src={organizationImage(user.avatar_url)} size="md" decorative />
      <span className="entry-who">
        <Text weight="medium">{name}</Text>
        {user.display_name?.trim() && (
          <Text size="sm" tone="subtle">
            {user.email}
          </Text>
        )}
      </span>
      <button type="button" className="entry-text-button" disabled={disabled} onClick={onSignOut}>
        {t("entry.signOut")}
      </button>
    </div>
  );
}

/** The "or" between the main path and the alternatives. */
export function EntryOr() {
  const { t } = useTranslation("auth-flow");
  return <div className="entry-or">{t("entry.or")}</div>;
}
