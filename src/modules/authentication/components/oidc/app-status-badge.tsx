import { Badge, formatDate } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { AppStatus } from "@/modules/authentication/oidc-apps-model";

/** An application's one status in a word, its date on hover. */
export function AppStatusBadge({ status }: { status: AppStatus }) {
  const { t } = useTranslation("oidc");
  const locale = formatLocale();
  if (status.kind === "pkceExempt")
    return (
      <Badge
        tone="warning"
        size="sm"
        title={t("status.pkceExemptTitle", {
          date: formatDate(status.until, locale, { dateStyle: "long" }),
        })}
      >
        {t("status.pkceExempt", {
          date: formatDate(status.until, locale, { dateStyle: "medium" }),
        })}
      </Badge>
    );
  if (status.kind === "pkceEnded")
    return (
      <Badge tone="danger" size="sm">
        {t("status.pkceEnded")}
      </Badge>
    );
  if (status.kind === "localhost")
    return (
      <Badge tone="neutral" size="sm">
        {t("status.localhost")}
      </Badge>
    );
  return (
    <Badge tone="success" size="sm">
      {t("status.active")}
    </Badge>
  );
}
