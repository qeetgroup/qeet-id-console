import { Button, EmptyState } from "@qeetrix/ui";
import { CompassIcon, HouseIcon } from "@qeetrix/icons";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/** Renders the page for a console address with no screen behind it. */
export function NotFoundPage() {
  const { t } = useTranslation("dashboard");
  return (
    <div className="rounded-xl border bg-card p-8">
      <EmptyState
        icon={CompassIcon}
        title={t("notFound.title")}
        description={t("notFound.description")}
        action={
          <Button size="sm" render={<Link to="/" />}>
            <HouseIcon className="size-4" />
            {t("notFound.home")}
          </Button>
        }
      />
    </div>
  );
}
