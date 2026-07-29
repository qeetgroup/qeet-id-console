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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import {
  formatMoney,
  useCancelSubscription,
  useCheckout,
  useInvoices,
  usePlans,
  useSubscription,
} from "@/lib/billing";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
});

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
  const plansQ = usePlans();
  const subQ = useSubscription();
  const invoicesQ = useInvoices();
  const checkoutM = useCheckout();
  const cancelM = useCancelSubscription();

  const apiPlans = useMemo(() => plansQ.data?.items ?? [], [plansQ.data]);
  const sub = subQ.data;

  // Currencies offered = union of every plan's priced currencies (still used for checkout).
  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const p of apiPlans) for (const c of Object.keys(p.prices)) set.add(c);
    return [...set].sort();
  }, [apiPlans]);

  const [currency, setCurrency] = useState<string | null>(null);
  const activeCurrency =
    currency ?? sub?.currency ?? (currencies.includes("USD") ? "USD" : currencies[0]) ?? "USD";

  // Country selects the payment provider; defaults to the active currency's home
  // country until the admin picks one explicitly.
  const [country, setCountry] = useState<string | null>(null);
  const activeCountry = country ?? CURRENCY_COUNTRY[activeCurrency] ?? "US";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {confirmDialog}
      <PageHeader
        description={t("billing.description")}
        actions={
          currencies.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("billing.country")}</span>
                <Select value={activeCountry} onValueChange={setCountry}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

        {/* Plan picker — rendered from static PLANS, isCurrent matched via API subscription */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = sub?.plan_code === plan.code && !sub?.cancel_at_period_end;
            const isEnterprise = plan.code === "enterprise";
            // Price shown in the selected currency, from the API; fall back to the
            // static label when the plan isn't priced in that currency.
            const priceMinor = apiPlans.find((p) => p.code === plan.code)?.prices?.[activeCurrency];
            const displayPrice =
              isEnterprise || priceMinor === undefined
                ? plan.price
                : formatMoney(priceMinor, activeCurrency);

            return (
              <Card
                key={plan.code}
                className={cn(
                  "relative flex flex-col overflow-hidden transition-shadow",
                  plan.featured ? "border-primary shadow-lg shadow-primary/10" : "border-border/60",
                  isCurrent && "ring-2 ring-primary/30",
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
                        <span className="text-xs text-muted-foreground">{plan.period}</span>
                      )}
                    </div>
                    {isEnterprise && (
                      <p className="text-xs text-muted-foreground capitalize">{plan.period}</p>
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
                    <div className="mt-auto pt-2">
                      <p className="text-center text-xs text-muted-foreground">
                        Need Enterprise?{" "}
                        <a
                          href="mailto:sales@qeet.in"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {t("billing.plan.salesEmail")}
                        </a>
                      </p>
                    </div>
                  ) : (
                    <Button
                      variant={plan.featured ? "default" : "outline"}
                      className="w-full"
                      disabled={isCurrent || checkoutM.isPending}
                      onClick={() =>
                        checkoutM.mutate({
                          plan_code: plan.code,
                          currency: activeCurrency,
                          country: activeCountry,
                        })
                      }
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
