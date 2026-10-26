import { ArrowRightIcon, RefreshCwIcon } from "@qeetrix/icons";
import { Button, Field, Heading, Select, Spinner, Text, Toggle, ToggleGroup } from "@qeetrix/react";
import { Alert, Steps } from "@qeetrix/react/experimental";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { type BillingInterval, startSignupCheckout, usePlans } from "@/modules/billing";
import type { PublicSession } from "@/platform/auth/server-session";
import { useLogout, useMe, useUserId } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { isOneOf } from "@/shared/utils/one-of";

import { createOrganization } from "../api/create-organization";
import { useHasOrganization } from "../api/memberships";
import { loadPage } from "../load-page";
import { type OnboardingProfile, stashOnboardingProfile } from "../onboarding-profile";
import { CURRENCY_COUNTRY, TIER_ORDER, type Tier } from "../plan-catalog";
import {
  bestYearlySaving,
  currencyLabel,
  defaultCurrency,
  planCurrencies,
  planOffers,
} from "../plan-pricing";
import { DetailsStep, INLINE_IMAGE, type Logo, type OrganisationDetails } from "./details-step";
import { PlanCards, PlanCardsLoading } from "./plan-cards";
import { PlanSummary } from "./plan-summary";
import { ProjectStep } from "./project-step";
import { SalesSent, SalesStep } from "./sales-step";
import { type CheckoutParams, useCheckoutReturn } from "../use-checkout-return";

/** Where the page was opened from, so Cancel goes back there. */
export type CreateOrganizationFrom = "select-organization" | "organizations";
const LEAVE_TO = {
  "select-organization": "/select-organization",
  organizations: "/organizations",
} as const;

type Step = "plan" | "project" | "details" | "sales" | "sent";
const HEAD = {
  plan: ["create.plan.title", "create.plan.lead"],
  project: ["create.project.title", "create.project.lead"],
  details: ["create.details.title", "create.details.lead"],
  sales: ["create.sales.title", "create.sales.lead"],
  sent: ["create.sales.sentTitle", "create.sales.sentLead"],
} as const;
const STEP_INDEX: Record<Step, number> = { plan: 0, project: 1, details: 2, sales: 1, sent: 2 };

/**
 * Creating an organisation, as one page for every way in: the organisation picker, Directory ›
 * Organizations, and straight after signing up for someone with none (their first, with nowhere
 * to cancel back to). Plan, then the optional project questions, then its details; Enterprise goes
 * to a sales enquiry instead. Free is created at once; a paid plan is created by checkout once the
 * payment goes through, and checkout comes back here: to finish it, or, cancelled, to the details
 * as they were.
 */
export function CreateOrganizationPage({
  session,
  from,
  checkout,
}: {
  session: PublicSession;
  from?: CreateOrganizationFrom;
  checkout?: CheckoutParams;
}) {
  const { t } = useTranslation("onboarding");
  const navigate = useNavigate();
  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);
  const userId = useUserId();
  const me = useMe().data;
  // Someone with no organisation is setting up their first: there is nothing to cancel back to.
  const member = useHasOrganization(userId);
  const first = !from && member.data !== true;

  const [step, setStep] = useState<Step>("plan");
  const [tier, setTier] = useState<Tier>("free");
  const [cycle, setCycle] = useState<BillingInterval>("month");
  const [currency, setCurrency] = useState<string | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile>({});
  const [details, setDetails] = useState<OrganisationDetails>({
    name: "",
    slug: "",
    slugEdited: false,
    region: "ap-south-1",
  });
  const [logo, setLogo] = useState<Logo | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const plansQ = usePlans();
  const plans = plansQ.data?.items ?? [];
  const currencies = planCurrencies(plans);
  const activeCurrency =
    currency && currencies.includes(currency) ? currency : defaultCurrency(currencies);
  const offers = planOffers(plans, cycle, activeCurrency);
  const offer = offers.find((item) => item.tier === tier);
  const saving = bestYearlySaving(plans, activeCurrency);
  const paid = !!offer && !offer.contactSales && !!offer.price;

  const create = useMutation({
    mutationFn: createOrganization,
    meta: { silent: true }, // shown in the page: a taken URL on its field
  });
  const busy = create.isPending || paying;

  // A new step moves focus to its heading, which also brings the top of the page into view.
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(step);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    heading.current?.focus();
  }, [step]);

  const leave = () => void navigate({ to: from ? LEAVE_TO[from] : "/" });

  // Back from checkout: its fields leave the address once read.
  const clearCheckout = useCallback(
    () =>
      void navigate({ to: "/create-organization", search: from ? { from } : {}, replace: true }),
    [navigate, from],
  );
  const returned = useCheckoutReturn(checkout ?? {}, clearCheckout);
  const restored = useRef(false);
  useEffect(() => {
    if (returned.state !== "cancelled" || restored.current) return;
    restored.current = true;
    setCancelled(true);
    const pending = returned.pending;
    const draft = pending?.draft;
    if (!pending || !draft || !isOneOf(TIER_ORDER, draft.tier)) return;
    const { logo_url, ...answers } = pending.profile;
    setTier(draft.tier);
    setCycle(draft.cycle);
    setCurrency(draft.currency);
    setProfile(answers);
    setDetails({ name: draft.name, slug: pending.slug, slugEdited: true, region: draft.region });
    // Only an image this page made goes back on it.
    if (logo_url && INLINE_IMAGE.test(logo_url)) {
      setLogo({ url: logo_url, name: t("create.details.logo"), size: (logo_url.length * 3) / 4 });
    }
    setStep("details");
  }, [returned, t]);

  async function submit() {
    if (!offer || busy) return;
    const name = details.name.trim();
    const slug = details.slug.trim();
    setFailure(null);
    setTaken(null);
    // Kept for the new organisation's first dashboard, whether it's created now or after
    // checkout; the slug ties it to that organisation.
    if (userId) {
      stashOnboardingProfile({
        profile: { ...profile, logo_url: logo?.url },
        slug,
        userId,
        // Put back if the payment is cancelled, and named while the paid one is being made.
        draft: { name, region: details.region, tier, cycle, currency: activeCurrency },
      });
    }
    try {
      if (paid) {
        setPaying(true);
        const origin = window.location.origin;
        const checkout = await startSignupCheckout({
          orgName: name,
          orgSlug: slug,
          region: details.region,
          planCode: offer.planCode,
          currency: activeCurrency,
          country: CURRENCY_COUNTRY[activeCurrency] ?? "US",
          successUrl: `${origin}/create-organization?checkout=success`,
          cancelUrl: `${origin}/create-organization?checkout=cancelled`,
        });
        if (checkout.status === "checkout" && checkout.checkout_url) {
          loadPage(checkout.checkout_url);
          return;
        }
      } else {
        await create.mutateAsync({
          slug,
          name,
          plan: offer.tier,
          region: details.region,
          logo_url: logo?.url,
        });
      }
      loadPage("/");
    } catch (err) {
      setPaying(false);
      if (normalizeError(err).code === ERROR_CODES.ORG_SLUG_TAKEN) setTaken(slug);
      else setFailure(errorMessage(err));
    }
  }

  const sales = tier === "enterprise";
  const steps = sales
    ? [{ label: t("create.steps.plan") }, { label: t("create.steps.sales") }]
    : [
        { label: t("create.steps.plan") },
        { label: t("create.steps.project") },
        { label: t("create.steps.details") },
      ];
  const [title, lead] =
    step === "plan" && first
      ? (["create.plan.firstTitle", "create.plan.firstLead"] as const)
      : HEAD[step];
  const cancelledNotice = cancelled && (
    <Alert tone="info" title={t("create.cancelled.title")}>
      {t(step === "details" ? "create.cancelled.body" : "create.cancelled.bodyPlain")}
    </Alert>
  );

  if (returned.state === "finishing" || returned.state === "slow") {
    const draft = returned.pending?.draft;
    const planName = offers.find((item) => item.tier === draft?.tier)?.name;
    const named = draft && planName ? { name: draft.name, plan: planName } : null;
    const slow = returned.state === "slow";
    return (
      <div className="create">
        <div className="create-head">
          <div className="create-head-text">
            <Heading level={1} size="display-sm" ref={heading} tabIndex={-1}>
              {t(slow ? "create.finishing.slowTitle" : "create.finishing.title")}
            </Heading>
            <Text tone="subtle" size="lg">
              {named
                ? t(slow ? "create.finishing.slowLead" : "create.finishing.lead", named)
                : t(slow ? "create.finishing.slowLeadPlain" : "create.finishing.leadPlain")}
            </Text>
          </div>
          <Steps className="create-steps" steps={steps} current={steps.length} />
        </div>
        <div className="create-form create-finishing">
          {returned.state === "slow" ? (
            <Alert
              tone="info"
              title={t("create.finishing.slowAlertTitle")}
              actions={
                <Button variant="soft" icon={RefreshCwIcon} onClick={returned.checkAgain}>
                  {t("create.finishing.checkAgain")}
                </Button>
              }
            >
              {t("create.finishing.slowAlertBody")}
            </Alert>
          ) : (
            <p className="entry-status" role="status">
              <Spinner size="md" decorative />
              {named
                ? t("create.finishing.status", { name: named.name })
                : t("create.finishing.statusPlain")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const summary = offer && (
    <PlanSummary
      offer={offer}
      currency={activeCurrency}
      onChange={step === "sent" ? undefined : () => setStep("plan")}
      disabled={busy}
    />
  );

  return (
    <div className="create">
      <div className="create-head">
        <div className="create-head-text">
          <Heading level={1} size="display-sm" ref={heading} tabIndex={-1}>
            {t(title)}
          </Heading>
          <Text tone="subtle" size="lg">
            {t(lead)}
          </Text>
        </div>
        <Steps
          className="create-steps"
          steps={steps}
          current={step === "sent" ? steps.length : STEP_INDEX[step]}
          onStepSelect={
            busy || step === "sent"
              ? undefined
              : (index) => setStep(index === 0 ? "plan" : "project")
          }
        />
      </div>

      {step === "plan" || !offer ? (
        <>
          {cancelledNotice}
          <div className="create-plan-bar">
            <ToggleGroup
              variant="segmented"
              size="lg"
              aria-label={t("create.plan.cycle")}
              value={[cycle]}
              onValueChange={(value) => value[0] && setCycle(value[0] as BillingInterval)}
              disabled={plans.length === 0}
            >
              <Toggle value="month">{t("create.plan.month")}</Toggle>
              <Toggle value="year">
                {saving > 0
                  ? t("create.plan.yearSaving", { percent: saving })
                  : t("create.plan.year")}
              </Toggle>
            </ToggleGroup>
            {currencies.length > 1 && (
              <Field label={t("create.plan.currency")} className="create-currency">
                <Select
                  items={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
                  value={activeCurrency}
                  onValueChange={(code) => code && setCurrency(code)}
                />
              </Field>
            )}
          </div>
          {plansQ.isLoading ? (
            <PlanCardsLoading />
          ) : plansQ.isError ? (
            <Alert
              tone="danger"
              title={t("create.plan.errorTitle")}
              actions={
                <Button variant="ghost" icon={RefreshCwIcon} onClick={() => void plansQ.refetch()}>
                  {t("create.plan.retry")}
                </Button>
              }
            >
              {t("create.plan.errorBody")}
            </Alert>
          ) : offers.length === 0 ? (
            <Alert tone="info" title={t("create.plan.emptyTitle")}>
              {t("create.plan.emptyBody")}
            </Alert>
          ) : (
            <PlanCards
              offers={offers}
              value={tier}
              onValueChange={setTier}
              currency={activeCurrency}
            />
          )}
          <div className="create-actions">
            {!first && (
              <Button variant="ghost" size="lg" onClick={leave}>
                {t("create.cancel")}
              </Button>
            )}
            <Button
              size="lg"
              icon={ArrowRightIcon}
              disabled={!offer || offer.unavailable}
              onClick={() => setStep(sales ? "sales" : "project")}
            >
              {!offer
                ? t("create.continue")
                : sales
                  ? t("create.plan.talkToSales")
                  : t("create.plan.continue", { plan: offer.name })}
            </Button>
          </div>
        </>
      ) : (
        <div className="create-split">
          {step === "project" ? (
            <ProjectStep
              profile={profile}
              onProfileChange={setProfile}
              onBack={() => setStep("plan")}
              onContinue={() => setStep("details")}
              onSkip={() => {
                setProfile({});
                setStep("details");
              }}
            />
          ) : step === "details" ? (
            <DetailsStep
              details={details}
              onDetailsChange={setDetails}
              logo={logo}
              onLogoChange={setLogo}
              paid={paid}
              busy={busy}
              slugTaken={taken}
              error={failure}
              notice={cancelledNotice}
              onBack={() => setStep("project")}
              onSubmit={() => void submit()}
            />
          ) : step === "sales" ? (
            <SalesStep
              defaults={{ name: me?.display_name ?? "", email: me?.email ?? "" }}
              onBack={() => setStep("plan")}
              onSent={(email) => {
                setSentTo(email);
                setStep("sent");
              }}
            />
          ) : (
            <SalesSent
              email={sentTo}
              leaveLabel={t(`create.leave.${from ?? "home"}`)}
              onLeave={leave}
              onStartFree={() => {
                setTier("free");
                setStep("project");
              }}
            />
          )}
          {summary}
        </div>
      )}
    </div>
  );
}

/** Who the organisation will belong to, in the page's foot, and the way out. */
export function SignedInAs() {
  const { t } = useTranslation("onboarding");
  const me = useMe().data;
  const logout = useLogout();
  if (!me) return null;
  const name = me.display_name ? `${me.display_name} · ${me.email}` : me.email;
  return (
    <span className="create-signed-in">
      <span>{t("create.signedInAs", { name })}</span>
      <button
        type="button"
        className="entry-text-button"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {t("create.signOut")}
      </button>
    </span>
  );
}
