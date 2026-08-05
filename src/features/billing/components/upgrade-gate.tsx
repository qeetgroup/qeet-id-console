import { buttonVariants, Card, CardContent } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { LockIcon, type LucideIcon } from "lucide-react";

import { useEntitlements } from "@/lib/billing";

/**
 * UpgradeGate is the locked-feature placeholder for plan-gated surfaces: a
 * dashed card (house style, matching ComingSoon) that names the feature and
 * links to the billing page. Used when a boolean plan feature (SSO, SCIM,
 * LDAP, …) isn't included in the tenant's plan.
 */
export function UpgradeGate({
  icon: Icon = LockIcon,
  title,
  description,
  plan,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  /** Recommended tier to preselect on the billing page (in-context deep-link). */
  plan?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        <Link
          to="/settings/billing"
          search={plan ? { plan } : {}}
          className={buttonVariants({ size: "sm" })}
        >
          Upgrade plan
        </Link>
      </CardContent>
    </Card>
  );
}

// Which tier first unlocks each gated feature — used to deep-link the Upgrade CTA
// straight to the right plan (mirrors the server entitlements catalog).
const FEATURE_PLAN: Record<string, string> = {
  sms_mfa: "starter",
  custom_branding: "starter",
  custom_domain: "starter",
  webhooks: "starter",
  sso: "pro",
  audit_export: "pro",
  ai_copilot: "pro",
  abac: "pro",
  scim: "enterprise",
  ldap: "enterprise",
};

/**
 * FeatureGate renders its children only when the current tenant's plan includes
 * `feature`; otherwise it renders an UpgradeGate. The backend still enforces the
 * gate (a 402 on any create), so while entitlements are loading we render the
 * children optimistically rather than blocking paying customers on a spinner.
 */
export function FeatureGate({
  feature,
  title,
  description,
  children,
}: {
  feature: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { data, isPending } = useEntitlements();
  if (!isPending && data && data.features[feature] === false) {
    return <UpgradeGate title={title} description={description} plan={FEATURE_PLAN[feature]} />;
  }
  return <>{children}</>;
}
