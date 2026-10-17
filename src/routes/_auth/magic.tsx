import { Button, buttonVariants, Card, CardContent, Field, FieldLabel, Input } from "@qeetrix/ui";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CircleCheckIcon, LoaderCircleIcon, MailIcon } from "@qeetrix/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { BrandHero } from "@/modules/authentication/components/brand-hero";
import { ApiError } from "@/platform/api/client";
import {
  isMfaChallenge,
  MfaChallengeStep,
  useConsumeMagicLink,
  useRequestMagicLink,
  useResendMagicLink,
} from "@/modules/authentication";

interface MagicSearch {
  token?: string;
}

export const Route = createFileRoute("/_auth/magic")({
  component: MagicLinkPage,
  validateSearch: (search: Record<string, unknown>): MagicSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

// One route, two modes, as /forgot-password: without ?token= ask for a link;
// with it, sign in with the link (and, if it no longer works, send a new one
// to the same address).
function MagicLinkPage() {
  const { t } = useTranslation("auth-flow");
  const { token } = useSearch({ from: "/_auth/magic" });
  const consume = useConsumeMagicLink();
  const resend = useResendMagicLink();

  // Auto-consume on mount when the URL carries a token. useRef guards
  // against double-fire from React 19 strict mode.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!token || firedRef.current) return;
    firedRef.current = true;
    consume.mutate(token);
  }, [token, consume]);

  // The link proved the first factor; the account holds a second, or must
  // have one. The link is spent, so this step is the only way on.
  if (consume.data && isMfaChallenge(consume.data)) {
    return <MfaChallengeStep challenge={consume.data} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            {token ? renderStatus({ token, consume, resend, t }) : <RequestLink />}
          </div>
          <BrandHero />
        </CardContent>
      </Card>
    </div>
  );
}

/** Asks for a sign-in link; the answer is the same for any address. */
function RequestLink() {
  const { t } = useTranslation("auth-flow");
  const request = useRequestMagicLink();
  const [email, setEmail] = useState("");
  if (request.isSuccess) {
    return (
      <>
        <MailIcon className="size-10 text-sky-500" />
        <h1 className="text-2xl font-bold">{t("magic.sentTitle")}</h1>
        <p className="text-balance text-muted-foreground">{t("magic.sentText")}</p>
        <Link to="/sign-in" className={buttonVariants({ variant: "outline" }) + " mt-2"}>
          {t("magic.backToSignIn")}
        </Link>
      </>
    );
  }
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate(email.trim());
      }}
    >
      <h1 className="text-center text-2xl font-bold">{t("magic.requestTitle")}</h1>
      <p className="text-balance text-center text-muted-foreground">{t("magic.requestText")}</p>
      <Field>
        <FieldLabel htmlFor="magic-email">{t("magic.emailLabel")}</FieldLabel>
        <Input
          id="magic-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {request.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(request.error)}
        </p>
      )}
      <Button type="submit" disabled={request.isPending || !email.trim()}>
        {request.isPending && <LoaderCircleIcon className="animate-spin" />}
        {t("magic.requestBtn")}
      </Button>
      <Link to="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {t("magic.backToSignIn")}
      </Link>
    </form>
  );
}

function renderStatus({
  token,
  consume,
  resend,
  t,
}: {
  token: string;
  consume: ReturnType<typeof useConsumeMagicLink>;
  resend: ReturnType<typeof useResendMagicLink>;
  t: (key: string) => string;
}) {
  if (consume.isPending || consume.isIdle) {
    return (
      <>
        <LoaderCircleIcon className="size-10 animate-spin text-sky-500" />
        <h1 className="text-2xl font-bold">{t("magic.loadingTitle")}</h1>
        <p className="text-balance text-muted-foreground">{t("magic.loadingText")}</p>
      </>
    );
  }

  if (consume.isSuccess) {
    return (
      <>
        <CircleCheckIcon className="size-10 text-emerald-500" />
        <h1 className="text-2xl font-bold">{t("magic.successTitle")}</h1>
        <p className="text-balance text-muted-foreground">{t("magic.successText")}</p>
      </>
    );
  }

  // Error path. Distinguish expired/used vs everything else so the user
  // sees actionable copy.
  const status = consume.error instanceof ApiError ? consume.error.status : undefined;
  const detail = consume.error ? errorMessage(consume.error) : "Unknown error";
  const isExpiredOrUsed = status === 400;

  return (
    <>
      <MailIcon className="size-10 text-rose-500" />
      <h1 className="text-2xl font-bold">
        {isExpiredOrUsed ? t("magic.expiredTitle") : t("magic.errorTitle")}
      </h1>
      <p className="text-balance text-muted-foreground">
        {isExpiredOrUsed ? t("magic.expiredText") : detail}
      </p>
      <div className="mt-4 flex gap-2">
        <Link to="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {t("magic.backToSignIn")}
        </Link>
        {resend.isSuccess ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("magic.resentText")}
          </p>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={resend.isPending}
            onClick={() => resend.mutate(token)}
          >
            {resend.isPending && <LoaderCircleIcon className="animate-spin" />}
            {t("magic.sendNewLink")}
          </Button>
        )}
      </div>
    </>
  );
}
