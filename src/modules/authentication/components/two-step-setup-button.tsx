import { ShieldCheckIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

/**
 * Opens the account page where a second factor is set up. Offered where an organisation that
 * requires two-step verification refused entry: unlike a missing permission, the person can fix it.
 */
export function TwoStepSetupButton(props: { disabled?: boolean; onClick: () => void }) {
  const { t } = useTranslation("auth-flow");
  return (
    <Button
      variant="soft"
      size="sm"
      icon={ShieldCheckIcon}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {t("organizationSelection.setUpTwoStep")}
    </Button>
  );
}
