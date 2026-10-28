import { lazy, type ReactNode, Suspense } from "react";

import { useEntitlements } from "../api/billing";

// Loaded only once a plan lacks the feature, so pages that gate on it don't carry the prompt.
const UpgradeGate = lazy(() => import("./upgrade-prompt"));

// The tier that first unlocks each feature, so the link opens Change plan on it. Mirrors the
// server's entitlements catalogue.
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
  children: ReactNode;
}) {
  const { data, isPending } = useEntitlements();
  if (!isPending && data && data.features[feature] === false) {
    return (
      <Suspense fallback={null}>
        <UpgradeGate title={title} description={description} plan={FEATURE_PLAN[feature]} />
      </Suspense>
    );
  }
  return <>{children}</>;
}
