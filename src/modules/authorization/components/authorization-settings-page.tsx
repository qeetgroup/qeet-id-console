import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { GaugeIcon, type IconProps, LayersIcon, ShieldIcon } from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";

/** Renders the authorization settings. */
export function AuthorizationSettingsPage() {
  const { t } = useTranslation("authorization");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("authorizationSettingsPage.howTheAuthorizationEngine")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayersIcon className="size-4" aria-hidden />{" "}
            {t("authorizationSettingsPage.evaluationModel")}
          </CardTitle>
          <CardDescription>{t("authorizationSettingsPage.theOrderAndSemantics")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Fact
            title={t("authorizationSettingsPage.denyWins")}
            detail={t("authorizationSettingsPage.denyWinsDetail")}
          />
          <Fact
            title={t("authorizationSettingsPage.priorityOrdering")}
            detail={t("authorizationSettingsPage.priorityOrderingDetail")}
          />
          <Fact
            title={t("authorizationSettingsPage.composedEngines")}
            detail={t("authorizationSettingsPage.composedEnginesDetail")}
          />
          <Fact
            title={t("authorizationSettingsPage.explainability")}
            detail={t("authorizationSettingsPage.explainabilityDetail")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <LinkCard
          icon={ShieldIcon}
          title={t("authorizationSettingsPage.securityPolicy")}
          detail={t("authorizationSettingsPage.securityPolicyDetail")}
          to="/settings/organization/security-policy"
          badge={t("authorizationSettingsPage.tenantPolicy")}
        />
        <LinkCard
          icon={GaugeIcon}
          title={t("authorizationSettingsPage.accessTester")}
          detail={t("authorizationSettingsPage.accessTesterDetail")}
          to="/authorization/access-tester"
          badge={t("authorizationSettingsPage.diagnostics")}
        />
      </div>
    </div>
  );
}

function Fact({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function LinkCard({
  icon: Icon,
  title,
  detail,
  to,
  badge,
}: {
  icon: ComponentType<IconProps<"outline">>;
  title: string;
  detail: string;
  to: string;
  badge: string;
}) {
  const { t } = useTranslation("authorization");
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" aria-hidden /> {title}
          </CardTitle>
          <Badge variant="muted">{badge}</Badge>
        </div>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={to} className="text-sm text-primary hover:underline">
          {t("authorizationSettingsPage.open")}
        </Link>
      </CardContent>
    </Card>
  );
}
