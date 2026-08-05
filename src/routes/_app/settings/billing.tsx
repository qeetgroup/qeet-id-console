import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DataState,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ContactSalesDialog } from "@/features/billing/components/contact-sales-dialog";
import {
  type BillingProfile,
  formatMoney,
  useBillingProfile,
  useCancelSubscription,
  useCheckout,
  useEntitlements,
  useInvoices,
  usePlans,
  useSaveBillingProfile,
  useStartTrial,
  useSubscription,
  useUsage,
} from "@/lib/billing";

// Deep-link params: `?plan=pro&interval=year` (from in-context Upgrade CTAs)
// preselects the billing period and highlights the recommended plan.
type BillingSearch = { plan?: string; interval?: "month" | "year" };

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
  validateSearch: (raw: Record<string, unknown>): BillingSearch => ({
    plan: typeof raw.plan === "string" ? raw.plan : undefined,
    interval: raw.interval === "year" ? "year" : raw.interval === "month" ? "month" : undefined,
  }),
});

// The Free-tier caps (the only finite limits — paid tiers are unlimited), used
// to warn before a downgrade to Free would put the org over a limit. Mirrors the
// server entitlements catalog; kept small and local since only Free bites.
const FREE_LIMITS: Record<string, number> = { seats: 5, apps: 3, api_keys: 2, custom_roles: 0 };

// Tracked resources for the usage-vs-limits display + downgrade warning.
const USAGE_RESOURCES: { key: string; label: string }[] = [
  { key: "seats", label: "Members" },
  { key: "apps", label: "Applications" },
  { key: "api_keys", label: "API keys" },
  { key: "custom_roles", label: "Custom roles" },
];

// Yearly plan code for a tier (starter/pro have `_year` variants; free/enterprise don't).
const yearlyCode = (tier: string) => (tier === "starter" || tier === "pro" ? `${tier}_year` : tier);

const EMPTY_PROFILE: BillingProfile = {
  legal_name: "",
  billing_email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
  tax_id_type: "none",
  tax_id: "",
};

// Billing & tax details captured for invoicing (GSTIN for India, VAT for the EU).
function BillingDetailsCard() {
  const profileQ = useBillingProfile();
  const saveM = useSaveBillingProfile();
  const [draft, setDraft] = useState<BillingProfile | null>(null);
  useEffect(() => {
    if (profileQ.data) setDraft(profileQ.data);
  }, [profileQ.data]);
  const d = draft ?? EMPTY_PROFILE;
  const set = <K extends keyof BillingProfile>(key: K, value: BillingProfile[K]) =>
    setDraft((p) => ({ ...(p ?? EMPTY_PROFILE), [key]: value }));
  const taxLabel =
    d.tax_id_type === "gstin" ? "GSTIN" : d.tax_id_type === "vat" ? "VAT number" : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing details</CardTitle>
        <CardDescription>
          Shown on your invoices. Add your GSTIN (India) or VAT number (EU) for tax-compliant
          invoices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft) saveM.mutate(draft);
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bp-legal">Legal / business name</FieldLabel>
                <Input
                  id="bp-legal"
                  value={d.legal_name}
                  onChange={(e) => set("legal_name", e.target.value)}
                  placeholder="Acme Technologies Pvt Ltd"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bp-email">Billing email</FieldLabel>
                <Input
                  id="bp-email"
                  type="email"
                  value={d.billing_email}
                  onChange={(e) => set("billing_email", e.target.value)}
                  placeholder="billing@acme.com"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="bp-addr1">Address</FieldLabel>
                <Input
                  id="bp-addr1"
                  value={d.address_line1}
                  onChange={(e) => set("address_line1", e.target.value)}
                  placeholder="Street address"
                />
                <Input
                  className="mt-2"
                  value={d.address_line2}
                  onChange={(e) => set("address_line2", e.target.value)}
                  placeholder="Suite, floor (optional)"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bp-city">City</FieldLabel>
                <Input id="bp-city" value={d.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="bp-state">State / region</FieldLabel>
                <Input
                  id="bp-state"
                  value={d.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bp-postal">Postal code</FieldLabel>
                <Input
                  id="bp-postal"
                  value={d.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Country</FieldLabel>
                <Select
                  value={d.country || undefined}
                  onValueChange={(v) => set("country", v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Tax ID type</FieldLabel>
                <Select
                  value={d.tax_id_type}
                  onValueChange={(v) => v && set("tax_id_type", v as BillingProfile["tax_id_type"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="gstin">GSTIN (India)</SelectItem>
                    <SelectItem value="vat">VAT (EU)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {d.tax_id_type !== "none" && (
                <Field>
                  <FieldLabel htmlFor="bp-taxid">{taxLabel}</FieldLabel>
                  <Input
                    id="bp-taxid"
                    value={d.tax_id}
                    onChange={(e) => set("tax_id", e.target.value)}
                    placeholder={d.tax_id_type === "gstin" ? "22AAAAA0000A1Z5" : "Tax number"}
                    className="font-mono"
                  />
                </Field>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saveM.isPending || !draft}>
                {saveM.isPending ? "Saving…" : "Save billing details"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function UsageMeters({
  usage,
  limits,
}: {
  usage: Record<string, number>;
  limits: Record<string, number>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {USAGE_RESOURCES.map(({ key, label }) => {
        const used = usage[key] ?? 0;
        const limit = limits[key] ?? -1;
        const unlimited = limit < 0;
        const atLimit = !unlimited && used >= limit;
        const pct = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : (used / limit) * 100);
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn("font-medium tabular-nums", atLimit && "text-destructive")}>
                {used}
                {unlimited ? " / ∞" : ` / ${limit}`}
              </span>
            </div>
            {!unlimited && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", atLimit ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Static plan display data — pricing, features, and visual decoration.
// The backend still controls checkout / subscription state; we match on plan.code.
const PLANS = [
  {
    code: "free",
    name: "Free",
    price: "Free",
    period: "forever",
    mau: "Up to 10,000 MAU",
    featured: false,
    badge: null as string | null,
    features: [
      "10,000 monthly active users",
      "Passkeys, social & password login",
      "Email magic links & TOTP MFA",
      "1 organization · RBAC (3 roles)",
      "7-day audit log retention",
      "Community support",
      "Hosted login",
    ],
  },
  {
    code: "starter",
    name: "Starter",
    price: "—",
    period: "/ month",
    mau: "Up to 25,000 MAU",
    featured: false,
    badge: null as string | null,
    features: [
      "25,000 monthly active users",
      "All MFA methods (SMS, email, passkey)",
      "Custom branding & 1 custom domain",
      "Webhooks · 30-day audit log",
      "Email support, 48h SLA",
      "99.9% uptime SLA",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    price: "—",
    period: "/ month",
    mau: "Up to 100,000 MAU included",
    featured: true,
    badge: "Most popular" as string | null,
    features: [
      "100,000 MAU included, then metered",
      "Enterprise SSO — SAML & OIDC (no SSO tax)",
      "RBAC + ABAC & advanced threat protection",
      "Audit export · 90-day retention",
      "AI Copilot",
      "Priority + chat support, 24h SLA",
      "99.95% uptime SLA",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "annual contract",
    mau: "Unlimited MAU & organizations",
    featured: false,
    badge: null as string | null,
    features: [
      "Unlimited MAU and organizations",
      "SCIM & LDAP directory sync",
      "SSO/MFA enforcement + conditional access",
      "BYOK, data residency & dedicated tenant",
      "Audit log → your S3 / SIEM",
      "SOC 2 Type II, ISO 27001, HIPAA BAA",
      "99.99% SLA · named CSM + onboarding",
    ],
  },
];

// Billing countries offered at checkout. Country selects the payment provider
// (backend PAYMENT_COUNTRY_ROUTES); currency is what's charged.
const COUNTRIES: { code: string; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" },
  { code: "SE", name: "Sweden" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "BR", name: "Brazil" },
  { code: "ZA", name: "South Africa" },
];

// Sensible default country for a currency, so the two selectors stay in sync
// until the admin overrides the country.
const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  INR: "IN",
  JPY: "JP",
  AUD: "AU",
  CAD: "CA",
};

function BillingPage() {
  const { t } = useTranslation("settings");
  const [confirmDialog, openConfirm] = useConfirmDialog();
  const [salesOpen, setSalesOpen] = useState(false);
  const plansQ = usePlans();
  const subQ = useSubscription();
  const invoicesQ = useInvoices();
  const checkoutM = useCheckout();
  const cancelM = useCancelSubscription();
  const startTrialM = useStartTrial();
  const entQ = useEntitlements();
  const usageQ = useUsage();
  const search = Route.useSearch();

  const apiPlans = useMemo(() => plansQ.data?.items ?? [], [plansQ.data]);
  const sub = subQ.data;

  // Trial state (no-card reverse trial). Eligible = no subscription yet.
  const trialing = sub?.status === "trialing";
  const trialEnd = sub?.trial_end ? new Date(sub.trial_end) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : 0;
  const trialExpired = trialing && (!trialEnd || trialEnd.getTime() <= Date.now());
  const trialEligible = !sub || sub.status === "none";

  // Currencies offered = union of every plan's priced currencies (still used for checkout).
  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const p of apiPlans) for (const c of Object.keys(p.prices)) set.add(c);
    return [...set].sort();
  }, [apiPlans]);

  const [currency, setCurrency] = useState<string | null>(null);
  // Note: a free org's subscription is {status:"none", currency:""} — an empty
  // string isn't nullish, so guard it explicitly (and require the code to be
  // priced) before falling back to a sensible default; otherwise the Select
  // binds to "" and shows blank.
  const subCurrency = sub?.currency && currencies.includes(sub.currency) ? sub.currency : undefined;
  const activeCurrency =
    currency ??
    subCurrency ??
    (currencies.includes("INR") ? "INR" : currencies.includes("USD") ? "USD" : currencies[0]) ??
    "USD";

  // Country (for payment-provider routing) is derived from the chosen currency —
  // no separate selector; the currency is what the admin picks.
  const activeCountry = CURRENCY_COUNTRY[activeCurrency] ?? "US";

  const [interval, setInterval] = useState<"month" | "year">(search.interval ?? "month");

  // Yearly savings vs 12× monthly, from Pro's live prices — drives the toggle callout.
  const savingsPct = useMemo(() => {
    const m = apiPlans.find((p) => p.code === "pro")?.prices?.[activeCurrency];
    const y = apiPlans.find((p) => p.code === "pro_year")?.prices?.[activeCurrency];
    if (!m || !y) return 0;
    return Math.max(0, Math.round((1 - y / (m * 12)) * 100));
  }, [apiPlans, activeCurrency]);

  // Switch plans; warn first when a downgrade to Free would exceed its caps.
  const switchTo = (tier: string, planCode: string) => {
    const doCheckout = () =>
      checkoutM.mutate({ plan_code: planCode, currency: activeCurrency, country: activeCountry });
    if (tier === "free" && usageQ.data) {
      const usage = usageQ.data.usage;
      const over = USAGE_RESOURCES.filter(({ key }) => (usage[key] ?? 0) > FREE_LIMITS[key]);
      if (over.length > 0) {
        const overText = over
          .map(({ key, label }) => `${label.toLowerCase()} (${usage[key]}/${FREE_LIMITS[key]})`)
          .join(", ");
        openConfirm({
          title: "Downgrade to Free?",
          description: `You're over the Free limits for ${overText}. Existing items stay, but you won't be able to add more until you're back under the limit.`,
          variant: "destructive",
          confirmLabel: "Downgrade anyway",
          onConfirm: doCheckout,
        });
        return;
      }
    }
    doCheckout();
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {confirmDialog}
      <ContactSalesDialog open={salesOpen} onOpenChange={setSalesOpen} source="billing" />
      <PageHeader
        description={t("billing.description")}
        actions={
          currencies.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <SegmentedControl
                value={interval}
                onValueChange={(v) => setInterval(v as "month" | "year")}
                aria-label="Billing period"
              >
                <SegmentedControlItem value="month">Monthly</SegmentedControlItem>
                <SegmentedControlItem value="year">
                  {savingsPct > 0 ? `Yearly · save ${savingsPct}%` : "Yearly"}
                </SegmentedControlItem>
              </SegmentedControl>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("billing.currency")}</span>
                <Select value={activeCurrency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-27.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : undefined
        }
      />

      <DataState
        isLoading={plansQ.isLoading || subQ.isLoading}
        isError={plansQ.isError}
        error={plansQ.error}
        isEmpty={false}
        emptyTitle={t("billing.empty")}
        skeletonRows={3}
      >
        {/* Current subscription */}
        {sub && sub.status !== "none" && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t("billing.currentPlan.title")}</CardTitle>
                  <CardDescription className="mt-1">
                    <span className="font-medium text-foreground">{sub.plan_name}</span>
                    {" · "}
                    {formatMoney(sub.amount_minor, sub.currency)} / {sub.interval}
                  </CardDescription>
                  {sub.current_period_end && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sub.cancel_at_period_end
                        ? t("billing.currentPlan.cancels")
                        : t("billing.currentPlan.renews")}{" "}
                      <TimeSince value={sub.current_period_end} />
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={sub.status} />
                  {!sub.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openConfirm({
                          title: t("billing.currentPlan.cancelConfirmTitle"),
                          description: t("billing.currentPlan.cancelConfirmDescription"),
                          variant: "destructive",
                          confirmLabel: t("billing.currentPlan.cancelConfirmLabel"),
                          onConfirm: () => cancelM.mutate(),
                        })
                      }
                      disabled={cancelM.isPending}
                    >
                      {t("billing.currentPlan.cancelPlan")}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* No-card trial CTA (eligible orgs) */}
        {trialEligible && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Try Pro free for 14 days</CardTitle>
                <CardDescription>
                  No card required — full Pro features (SSO, ABAC, audit export, AI Copilot).
                  Reverts to Free when the trial ends unless you upgrade.
                </CardDescription>
              </div>
              <Button
                size="sm"
                disabled={startTrialM.isPending}
                onClick={() => startTrialM.mutate({ plan_code: "pro", currency: activeCurrency })}
              >
                {startTrialM.isPending ? "Starting…" : "Start free trial"}
              </Button>
            </CardHeader>
          </Card>
        )}

        {/* Active trial banner */}
        {trialing && (
          <Card
            className={trialExpired ? "border-destructive/40" : "border-primary/30 bg-primary/5"}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {trialExpired
                    ? "Your Pro trial has ended"
                    : `Pro trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`}
                </CardTitle>
                <CardDescription>
                  {trialExpired
                    ? "You're back on Free. Upgrade to restore Pro features."
                    : "Upgrade any time to keep Pro when your trial ends."}
                </CardDescription>
              </div>
              <Button
                size="sm"
                disabled={checkoutM.isPending}
                onClick={() => switchTo("pro", interval === "year" ? "pro_year" : "pro")}
              >
                Upgrade to Pro
              </Button>
            </CardHeader>
          </Card>
        )}

        {/* Usage vs plan limits */}
        {entQ.data && usageQ.data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage</CardTitle>
              <CardDescription>Your current usage against your plan's limits.</CardDescription>
            </CardHeader>
            <CardContent>
              <UsageMeters usage={usageQ.data.usage} limits={entQ.data.limits} />
            </CardContent>
          </Card>
        )}

        {/* Plan picker — pricing/checkout driven by the live catalog + billing period */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isEnterprise = plan.code === "enterprise";
            // Yearly picks the `_year` variant for paid tiers; price + checkout
            // code both follow the selected billing period.
            const checkoutCode = interval === "year" ? yearlyCode(plan.code) : plan.code;
            const isCurrent =
              (sub?.plan_code === plan.code || sub?.plan_code === checkoutCode) &&
              !sub?.cancel_at_period_end;
            const isRecommended = search.plan === plan.code && !isCurrent;
            // Price shown in the selected currency, from the API; fall back to the
            // static label when the plan isn't priced in that currency.
            const priceMinor = apiPlans.find((p) => p.code === checkoutCode)?.prices?.[
              activeCurrency
            ];
            const displayPrice =
              isEnterprise || priceMinor === undefined
                ? plan.price
                : formatMoney(priceMinor, activeCurrency);
            const periodLabel =
              isEnterprise || priceMinor === 0
                ? plan.period
                : interval === "year"
                  ? "/ year"
                  : "/ month";

            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative flex flex-col overflow-hidden transition-shadow",
                  plan.featured ? "border-primary shadow-lg shadow-primary/10" : "border-border/60",
                  isCurrent && "ring-2 ring-primary/30",
                  isRecommended && "ring-2 ring-primary",
                )}
              >
                {/* Top gradient stripe for featured plan */}
                {plan.featured && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-primary/60 via-primary to-primary/60"
                  />
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      {plan.badge && (
                        <Badge
                          variant={plan.featured ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {plan.badge}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-[10px] text-primary"
                        >
                          {t("billing.plan.current")}
                        </Badge>
                      )}
                      {isRecommended && (
                        <Badge variant="default" className="text-[10px]">
                          Recommended
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="pt-3">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={cn(
                          "font-display text-3xl font-bold tracking-tight",
                          plan.featured && "text-primary",
                        )}
                      >
                        {displayPrice}
                      </span>
                      {!isEnterprise && (
                        <span className="text-xs text-muted-foreground">{periodLabel}</span>
                      )}
                    </div>
                    {isEnterprise && (
                      <p className="text-xs text-muted-foreground capitalize">{periodLabel}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{plan.mau}</p>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5">
                  {/* Feature list */}
                  <ul className="flex flex-1 flex-col gap-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isEnterprise ? (
                    <Button
                      variant="outline"
                      className="mt-auto w-full"
                      onClick={() => setSalesOpen(true)}
                    >
                      Contact sales
                    </Button>
                  ) : (
                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className="w-full"
                      disabled={isCurrent || checkoutM.isPending}
                      onClick={() => switchTo(plan.code, checkoutCode)}
                    >
                      {isCurrent
                        ? t("billing.plan.isCurrent")
                        : t("billing.plan.switchTo", { name: plan.name })}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Billing & tax details */}
        <BillingDetailsCard />

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.invoices.title")}</CardTitle>
            <CardDescription>{t("billing.invoices.description")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={invoicesQ.isLoading}
              isError={invoicesQ.isError}
              error={invoicesQ.error}
              isEmpty={(invoicesQ.data?.items?.length ?? 0) === 0}
              emptyTitle={t("billing.invoices.empty")}
              skeletonRows={2}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("billing.invoices.columns.issued")}</TableHead>
                    <TableHead>{t("billing.invoices.columns.period")}</TableHead>
                    <TableHead>{t("billing.invoices.columns.plan")}</TableHead>
                    <TableHead>{t("billing.invoices.columns.amount")}</TableHead>
                    <TableHead>{t("billing.invoices.columns.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoicesQ.data?.items ?? []).map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <TimeSince value={inv.issued_at} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <TimeSince value={inv.period_start} />
                        {" – "}
                        <TimeSince value={inv.period_end} />
                      </TableCell>
                      <TableCell className="capitalize">{inv.plan_code}</TableCell>
                      <TableCell className="font-medium">
                        {formatMoney(inv.amount_minor, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
          </CardContent>
        </Card>
      </DataState>
    </div>
  );
}
