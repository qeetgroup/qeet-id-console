import { buttonVariants, Card, CardContent } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { type IconProps, LockIcon } from "@qeetrix/icons";
import type { ComponentType } from "react";

import { useEntitlements } from "../api/billing";

/** Renders the placeholder for a feature the plan lacks: a dashed card linking to billing. */
export function UpgradeGate({
  icon: Icon = LockIcon,
  title,
  description,
  plan,
}: {
  icon?: ComponentType<IconProps<"outline">>;
  title: string;
  description: string;
  plan?: string; // tier to preselect on the billing page
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

// The tier that first unlocks each feature, so Upgrade deep-links to the right plan. Mirrors the
// server's entitlements catalog.
const FEATURE_PLAN: Record<string, string> = {
  sms_mfa: "starter",
  custom_branding: "starter",
  custom_domain: "starter",
  webhooks: "starter",
  sso: "pro",
  audit_export: "pro",
  ai_qeetai: "pro",
  abac: "pro",
  scim: "enterprise",
  ldap: "enterprise",
};

/**
 * Renders `children`, or an UpgradeGate once entitlements show the plan lacks `feature`. While they
 * load it renders children optimistically: the server still enforces the gate with a 402.
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
