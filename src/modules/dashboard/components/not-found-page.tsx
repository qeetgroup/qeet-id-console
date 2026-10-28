import { CompassIcon, HouseIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { StatePage } from "@/platform/components/state-page";

/** Renders the page for a console address with no screen behind it. */
export function NotFoundPage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  return (
    <StatePage
      icon={CompassIcon}
      title={t("notFound.title")}
      description={t("notFound.description")}
      actions={
        <Button icon={HouseIcon} onClick={() => void navigate({ to: "/" })}>
          {t("notFound.home")}
        </Button>
      }
    />
  );
}
