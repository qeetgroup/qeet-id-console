import { LockIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { EmptyState } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements } from "../api/billing";

/** In place of a feature the plan lacks: what it is, and the plans that include it. */
export function UpgradeGate({
  title,
  description,
  plan,
}: {
  title: string;
  description: string;
  plan?: string; // tier to preselect on the billing page
}) {
  const { t } = useTranslation("billing");
  return (
    <EmptyState
      icon={LockIcon}
      title={title}
      description={description}
      actions={
        <Button
          variant="soft"
          render={<Link to="/settings/billing" search={plan ? { plan } : {}} />}
        >
          {t("upgradeGate.upgradePlan")}
        </Button>
      }
    />
  );
}

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
    return <UpgradeGate title={title} description={description} plan={FEATURE_PLAN[feature]} />;
  }
  return <>{children}</>;
}
