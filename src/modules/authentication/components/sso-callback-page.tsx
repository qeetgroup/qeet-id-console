import { ArrowRightIcon, RefreshCwIcon } from "@qeetrix/icons";
import { Button, Heading, Link, Spinner, Text } from "@qeetrix/react";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { useConsumeSamlCode } from "../api/flows";
import { EntryPanel, useEntrySteps } from "./entry-panel";
import { EntryShell } from "./entry-shell";

// The SAML ACS passes the one-time code in the fragment (#saml_code=…), which, unlike a query
// string, never reaches the server or its access logs.
function readSamlCode(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash).get("saml_code");
}

/** Renders the return from an identity provider: exchanges its one-time code for a session. */
export function SsoCallbackPage() {
  const steps = useEntrySteps();
  return (
    <EntryShell panel={<EntryPanel steps={steps.sso} current={1} />}>
      <SsoStatus />
    </EntryShell>
  );
}

function SsoStatus() {
  const { t } = useTranslation("auth-flow");
  const navigate = useNavigate();
  const consume = useConsumeSamlCode();
  // Held here once read: the URL drops it, and a retry after a lost connection re-sends it.
  const [code] = useState(readSamlCode);

  const firedRef = useRef(false);
  useEffect(() => {
    if (!code || firedRef.current) return;
    firedRef.current = true;
    // Drop the code from the URL so it isn't left in history.
    window.history.replaceState(null, "", window.location.pathname);
    consume.mutate(code);
  }, [code, consume]);

  const signIn = (label: string) => (
    <Button
      size="lg"
      fullWidth
      icon={ArrowRightIcon}
      onClick={() => void navigate({ to: "/sign-in" })}
    >
      {label}
    </Button>
  );

  if (!code) {
    return (
      <>
        <Head title={t("sso.noCodeTitle")} lede={t("sso.noCodeText")} />
        {signIn(t("sso.signIn"))}
      </>
    );
  }

  if (consume.isError) {
    // A request that never reached Qeet ID left the code unspent, so sending it again can work.
    if (normalizeError(consume.error).kind === "network") {
      return (
        <>
          <Head title={t("sso.offlineTitle")} lede={t("sso.offlineText")} />
          <Button size="lg" fullWidth icon={RefreshCwIcon} onClick={() => consume.mutate(code)}>
            {t("sso.tryAgain")}
          </Button>
          <div className="entry-links">
            <Link render={<RouterLink to="/sign-in" />}>{t("sso.backToSignIn")}</Link>
          </div>
        </>
      );
    }
    return (
      <>
        <Head title={t("sso.failedTitle")} lede={errorMessage(consume.error)} />
        <Text tone="subtle">{t("sso.failedHint")}</Text>
        {signIn(t("sso.signInAgain"))}
      </>
    );
  }

  return (
    <>
      <Head title={t("sso.signingTitle")} lede={t("sso.signingText")} />
      <div className="entry-status" role="status">
        <Spinner />
        <Text tone="subtle">{consume.isSuccess ? t("sso.opening") : t("sso.checking")}</Text>
      </div>
    </>
  );
}

function Head({ title, lede }: { title: string; lede: ReactNode }) {
  return (
    <div className="entry-heading">
      <Heading level={1} size="display-sm">
        {title}
      </Heading>
      <Text tone="subtle" size="lg">
        {lede}
      </Text>
    </div>
  );
}
