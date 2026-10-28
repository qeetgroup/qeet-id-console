import { LockIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { EmptyState } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** In place of a feature the plan lacks: what it is, and the plans that include it. */
export default function UpgradeGate({
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
