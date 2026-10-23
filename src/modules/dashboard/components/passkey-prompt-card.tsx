import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { FingerprintPatternIcon, XIcon, ZapIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { canAddPasskey, usePasskeys } from "@/modules/authentication";
import { scopedStorage, useStorageScope } from "@/platform/auth/scoped-storage";

// Dismissed per person, so a shared browser still nudges the next one.
const dismissStorage = scopedStorage("qeetid-admin-passkey-prompt-dismissed");

/**
 * Renders a dismissible nudge to add a passkey, linking to the user's security settings. Hidden
 * while loading, once dismissed (kept for this person), when the user has a passkey, or when
 * the organization has passkeys switched off.
 */
export function PasskeyPromptCard() {
  const { t } = useTranslation("dashboard");
  // The scope is known only once the session hydrates, so the stored dismissal is read with it.
  const scope = useStorageScope();
  const [dismissedIn, setDismissedIn] = useState<string | null>(null);
  const dismissed = scope !== null && (dismissedIn === scope || dismissStorage.read() === true);
  const q = usePasskeys();

  if (dismissed) return null;
  if (q.isLoading) return null;
  if ((q.data?.items?.length ?? 0) > 0) return null;
  if (!canAddPasskey(q.data)) return null;

  function handleDismiss() {
    setDismissedIn(scope);
    dismissStorage.write(true); // best-effort: without storage it lasts this page
  }

  return (
    <Card className="border-info/25 bg-info/5 shadow-none hover:shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info ring-1 ring-info/15">
            <FingerprintPatternIcon className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold">
              {t("passkeyPromptCard.protectThisOperatorAccount")}
            </CardTitle>
            <CardDescription>{t("passkeyPromptCard.useTouchIdFace")}</CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common:actions.dismiss")}
          onClick={handleDismiss}
        >
          <XIcon />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 border-t border-info/15 pt-3">
        <Link to="/account/security" className={buttonVariants({ size: "sm" })}>
          <ZapIcon /> {t("passkeyPromptCard.addPasskey")}
        </Link>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          {t("passkeyPromptCard.notNow")}
        </Button>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {t("passkeyPromptCard.recommendedForPrivilegedOperators")}
        </span>
      </CardContent>
    </Card>
  );
}
