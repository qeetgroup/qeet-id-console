import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LogoField } from "@/components/logo-field";
import { type ApiError, api, tokenStore } from "@/lib/api";
import { startSignupCheckout } from "@/lib/billing";

import {
  type OnboardingProfile,
  ROLES,
  stashOnboardingProfile,
  TEAM_SIZES,
  USE_CASES,
} from "./onboarding-profile";
import { slugify } from "./plan-catalog";
import { PlanSelect, type PlanSelection } from "./plan-select";

type CreateTenantResponse = {
  tenant: { id: string; slug: string; name: string; plan: string };
  tenant_id: string;
  access_token?: string;
  refresh_token?: string;
};

const REGIONS = [
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
];

interface CreateOrgFlowProps {
  /**
   * Runs after the org is created and a free/enterprise plan is settled. Paid
   * plans redirect to the payment provider instead and never reach here — the
   * provider returns the browser to successUrl ("/"). Defaults to a hard nav to
   * the dashboard, which enters the freshly-created (now session-scoped) org.
   */
  onDone?: () => void;
  /** Optional cancel affordance (e.g. close a sheet) shown on the plan step. */
  onCancel?: () => void;
  /** Force single-column plan cards (for narrow containers like a sheet). */
  planStacked?: boolean;
  className?: string;
}

/**
 * Create-organization flow: choose a plan (+ billing cycle), name the org, then
 * pay. The org is created first (POST /v1/tenants returns a tenant-scoped token
 * we persist), so the tenant-scoped checkout that follows is authorized. Shared
 * by first-run onboarding and the "create another organization" action.
 */
export function CreateOrgFlow({ onDone, onCancel, planStacked, className }: CreateOrgFlowProps) {
  const done = onDone ?? (() => window.location.assign("/"));

  const [step, setStep] = useState<"plan" | "profile" | "name">("plan");
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
    // Own UX (redirect / inline error / toast) — skip the global error toast so
    // a "slug taken" doesn't double up with the inline message.
    meta: { silent: true },
  });

  // busy across both the create mutation and the checkout round-trip.
  const [paying, setPaying] = useState(false);
  const busy = createM.isPending || paying;

  function pickPlan(sel: PlanSelection) {
    setSelection(sel);
    setError(null);
    setStep("profile");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selection) return;
    setError(null);

    const isPaid = selection.tier !== "free" && selection.tier !== "enterprise";
    const origin = window.location.origin;

    // Stash the segmentation (+ logo) so it's applied to the org on first
    // dashboard load — uniform for free (created inline) and paid (provisioned
    // after checkout). See useApplyOnboardingProfile.
    stashOnboardingProfile({ ...profile, logo_url: logo || undefined });

    try {
      // Paid plans: DON'T create the org yet. Stage a checkout that carries the
      // org spec; the organization is created only when the payment completes,
      // so abandoning the payment leaves nothing behind.
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
        done(); // defensive — a paid plan should always return a checkout URL
        return;
      }

      // Free / Enterprise: no self-serve payment, so create the org now. The
      // response carries a tenant-scoped token we persist to switch straight in.
      const res = await createM.mutateAsync({
        slug: slug.trim(),
        name: name.trim(),
        plan: selection.tier,
        region,
        logo_url: logo || undefined,
      });
      if (res.access_token && res.refresh_token) {
        tokenStore.set(res.access_token);
        tokenStore.setRefresh(res.refresh_token);
      }
      tokenStore.setTenantId(res.tenant_id);
      if (selection.tier === "enterprise") {
        toast.success("Organization created — our team will reach out about Enterprise setup.");
      }
      done();
    } catch (err) {
      setPaying(false);
      const msg = (err as ApiError)?.message ?? "Something went wrong. Please try again.";
      setError(msg);
    }
  }

  if (step === "plan") {
    return (
      <div className={className}>
        <PlanSelect
          onSelect={pickPlan}
          stacked={planStacked}
          ctaLabel={(tier) =>
            tier === "enterprise"
              ? "Contact sales"
              : tier === "free"
                ? "Choose Free"
                : "Choose plan"
          }
        />
        {onCancel && (
          <div className="mt-5 flex justify-end">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (step === "profile") {
    return (
      <form
        className={cn("mx-auto w-full max-w-md", className)}
        onSubmit={(e) => {
          e.preventDefault();
          setStep("name");
        }}
      >
        <FieldGroup>
          <button
            type="button"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setStep("plan")}
          >
            <ArrowLeftIcon className="size-3.5" /> Choose a different plan
          </button>
          <div>
            <h2 className="text-base font-semibold">Tell us about your project</h2>
            <p className="text-sm text-muted-foreground">
              This tailors your setup checklist — optional, and you can change it later.
            </p>
          </div>

          <Field>
            <FieldLabel>What are you building?</FieldLabel>
            <Select
              value={profile.use_case ?? ""}
              onValueChange={(v) => setProfile((p) => ({ ...p, use_case: v || undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {USE_CASES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>How big is your team?</FieldLabel>
            <Select
              value={profile.team_size ?? ""}
              onValueChange={(v) => setProfile((p) => ({ ...p, team_size: v || undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Your role</FieldLabel>
            <Select
              value={profile.role ?? ""}
              onValueChange={(v) => setProfile((p) => ({ ...p, role: v || undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <Button type="submit">Continue</Button>
          </Field>
        </FieldGroup>
      </form>
    );
  }

  const isFree = selection?.tier === "free";
  const isEnterprise = selection?.tier === "enterprise";
  const submitLabel = isFree
    ? "Create organization"
    : isEnterprise
      ? "Create & contact sales"
      : "Continue to payment";
  const cycleLabel = selection?.interval === "year" ? "Yearly" : "Monthly";
  const tierName = selection
    ? selection.tier.charAt(0).toUpperCase() + selection.tier.slice(1)
    : "";

  return (
    <form className={cn("mx-auto w-full max-w-md", className)} onSubmit={submit}>
      <FieldGroup>
        <button
          type="button"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setStep("profile")}
          disabled={busy}
        >
          <ArrowLeftIcon className="size-3.5" />
          {tierName} plan{!isFree && !isEnterprise ? ` · ${cycleLabel}` : ""} — change
        </button>

        <Field>
          <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
          <Input
            id="org-name"
            name="name"
            placeholder="Acme Corp"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="org-slug">Slug</FieldLabel>
          <Input
            id="org-slug"
            name="slug"
            pattern="[a-z0-9-]+"
            minLength={2}
            maxLength={64}
            placeholder="acme"
            required
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
          <FieldDescription>Lowercase letters, numbers and hyphens. Used in URLs.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="org-region">Data region</FieldLabel>
          <Select value={region} onValueChange={(v) => v && setRegion(v)}>
            <SelectTrigger id="org-region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Logo</FieldLabel>
          <LogoField
            value={logo}
            onChange={setLogo}
            hint="Optional — we'll use an initials avatar if you skip it."
          />
        </Field>

        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={busy || !name.trim() || slug.trim().length < 2}>
            {busy && <Loader2Icon className="animate-spin" />}
            {busy ? "Setting up…" : submitLabel}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
