import { Button, cn } from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "@/platform/api/client";
import { useUserId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { startSignupCheckout } from "@/modules/billing";

import { type OnboardingProfile, stashOnboardingProfile } from "./onboarding-profile";
import { slugify } from "./plan-catalog";
import { PlanSelect, type PlanSelection } from "./plan-select";
import { SetupGuidance, SetupPlanNotes } from "./setup-guidance";
import { SetupOrganizationForm } from "./setup-organization-form";
import type { SetupStep } from "./setup-progress";
import { SetupProjectForm } from "./setup-project-form";
import { SETUP_FOCUS, SETUP_THEME } from "./setup-styles";

type CreateTenantResponse = {
  tenant: { id: string; slug: string; name: string; plan: string };
  tenant_id: string;
};

interface CreateOrgFlowProps {
  onDone?: () => void; // after a free or enterprise create; paid plans leave for checkout
  onCancel?: () => void; // shown on the plan step, e.g. to close a sheet
  planStacked?: boolean; // single-column plan cards for narrow containers
  renderHeader?: (step: SetupStep) => ReactNode; // a header above the step, for full-page hosts
  showGuidance?: boolean;
  className?: string;
}

/**
 * Renders the create-organization flow: pick a plan, optionally describe the project, then enter
 * organization details. Free plans create inline; paid plans are created after checkout.
 */
export function CreateOrgFlow({
  onDone,
  onCancel,
  planStacked,
  renderHeader,
  showGuidance = false,
  className,
}: CreateOrgFlowProps) {
  const { t } = useTranslation("dashboard");
  const done = onDone ?? (() => window.location.assign("/"));

  const [step, setStep] = useState<SetupStep>("plan");
  const [selection, setSelection] = useState<PlanSelection | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile>({});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [region, setRegion] = useState("ap-south-1");
  const [logo, setLogo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: (body: {
      slug: string;
      name: string;
      plan: string;
      region: string;
      logo_url?: string;
    }) => api<CreateTenantResponse>("/v1/tenants", { method: "POST", body }),
    meta: { silent: true }, // errors show inline, so a taken slug isn't also toasted
  });

  const userId = useUserId();
  const [paying, setPaying] = useState(false);
  const busy = createM.isPending || paying;

  function pickPlan(sel: PlanSelection) {
    setSelection(sel);
    setError(null);
    setStep("profile");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection || busy) return;
    setError(null);

    const isPaid = selection.tier !== "free" && selection.tier !== "enterprise";
    const origin = window.location.origin;

    // Stashed for the new organization's first dashboard load, whether it is created now or after
    // checkout; the slug ties it to that organization.
    if (userId) {
      stashOnboardingProfile({
        profile: { ...profile, logo_url: logo || undefined },
        slug: slug.trim(),
        userId,
      });
    }

    try {
      // Paid plans stage a checkout carrying the org spec; the organization is created only when
      // payment completes, so an abandoned payment leaves nothing behind.
      if (isPaid) {
        setPaying(true);
        const co = await startSignupCheckout({
          orgName: name.trim(),
          orgSlug: slug.trim(),
          region,
          planCode: selection.planCode,
          currency: selection.currency,
          country: selection.country,
          successUrl: `${origin}/?checkout=success`,
          cancelUrl: `${origin}/?checkout=cancelled`,
        });
        if (co.status === "checkout" && co.checkout_url) {
          window.location.href = co.checkout_url; // hand off to Razorpay / sandbox
          return;
        }
        done(); // defensive: a paid plan should always get a checkout URL
        return;
      }

      // Free and enterprise plans have no self-serve payment, so create now; the BFF moves the
      // session onto the new organization.
      await createM.mutateAsync({
        slug: slug.trim(),
        name: name.trim(),
        plan: selection.tier,
        region,
        logo_url: logo || undefined,
      });
      if (selection.tier === "enterprise") {
        toast.success(t("createOrgFlow.organizationCreatedOurTeam"));
      }
      done();
    } catch (err) {
      setPaying(false);
      setError(errorMessage(err));
    }
  }

  return (
    <div
      className={cn(
        SETUP_THEME,
        "@container/setup flex min-w-0 flex-col gap-5",
        step === "plan" && "gap-3.5",
        step === "name" && "gap-4",
        className,
      )}
    >
      {renderHeader?.(step)}
      {step === "plan" ? (
        <>
          <PlanSelect onSelect={pickPlan} stacked={planStacked} initialSelection={selection} />
          {showGuidance && <SetupPlanNotes />}
          {onCancel && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className={cn("h-8 text-xs", SETUP_FOCUS)}
                onClick={onCancel}
              >
                {t("setup.cancel")}
              </Button>
            </div>
          )}
        </>
      ) : selection ? (
        <div
          className={cn(
            "grid min-w-0 gap-3.5",
            showGuidance && !planStacked
              ? "@min-[700px]/setup:grid-cols-[minmax(0,1.85fr)_minmax(17rem,1fr)]"
              : "mx-auto w-full max-w-xl",
          )}
        >
          {step === "profile" ? (
            <SetupProjectForm
              selection={selection}
              profile={profile}
              onProfileChange={setProfile}
              onBack={() => setStep("plan")}
              onContinue={() => setStep("name")}
              onSkip={() => {
                setProfile({});
                setStep("name");
              }}
            />
          ) : (
            <SetupOrganizationForm
              selection={selection}
              name={name}
              slug={slug}
              region={region}
              logo={logo}
              busy={busy}
              error={error}
              onNameChange={(value) => {
                setName(value);
                if (!slugEdited) setSlug(slugify(value));
              }}
              onSlugChange={(value) => {
                setSlugEdited(true);
                setSlug(value);
              }}
              onRegionChange={setRegion}
              onLogoChange={setLogo}
              onBack={() => setStep("profile")}
              onChangePlan={() => {
                setError(null);
                setStep("plan");
              }}
              onSubmit={submit}
            />
          )}
          {showGuidance && !planStacked && <SetupGuidance kind={step} />}
        </div>
      ) : null}
    </div>
  );
}
