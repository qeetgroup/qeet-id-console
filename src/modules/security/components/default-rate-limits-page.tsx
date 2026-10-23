import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@qeetrix/ui";
import { ErrorText } from "@/platform/components/error-reference";
import { Link } from "@tanstack/react-router";
import { GaugeIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { useIpRules } from "../api/ip-allowlist";

// The server's per-IP defaults. The API also takes per-tenant, per-user and per-key overrides,
// which this screen doesn't manage.
// Each endpoint allows 5 requests a second with bursts of 20, per IP, in a sliding window;
// `endpoint: null` is every other authenticated endpoint, which is unlimited.
const STATIC_LIMITS: { endpoint: string | null; limited: boolean }[] = [
  { endpoint: "POST /v1/auth/login", limited: true },
  { endpoint: "POST /v1/auth/refresh", limited: true },
  { endpoint: "POST /v1/auth/signup", limited: true },
  { endpoint: "POST /v1/auth/forgot-password", limited: true },
  { endpoint: "POST /v1/oauth/token (client_credentials)", limited: true },
  { endpoint: null, limited: false },
];

/** Renders the platform's per-address rate limits, which the console doesn't change. */
export function DefaultRateLimitsPage() {
  const { t } = useTranslation("security");
  const rulesQ = useIpRules(); // IP rules decide who may sign in; this page only links there
  const rules = rulesQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("rateLimits.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rateLimits.perEndpoint.title")}</CardTitle>
          <CardDescription>{t("rateLimits.perEndpoint.description")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y rounded-md border">
          {STATIC_LIMITS.map((row) => (
            <div
              key={row.endpoint ?? "other"}
              className="flex items-center justify-between gap-4 p-3 text-sm"
            >
              <code className="text-xs">{row.endpoint ?? t("rateLimits.otherEndpoints")}</code>
              <div className="flex items-center gap-2">
                <Badge variant="muted">
                  {row.limited
                    ? t("rateLimits.rate", { rate: 5, burst: 20 })
                    : t("rateLimits.unlimited")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {row.limited ? t("rateLimits.perIpSliding") : "—"}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rateLimits.networkPolicy.title")}</CardTitle>
          <CardDescription>
            {t("rateLimits.networkPolicy.description")}{" "}
            <Link to="/security/threats/ip-allowlist" className="underline">
              {t("rateLimits.networkPolicy.openRules")}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : rulesQ.isError ? (
            <div className="text-sm text-destructive">
              <ErrorText error={rulesQ.error} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={rulesQ.data?.enabled ? "default" : "muted"}>
                {rulesQ.data?.enabled
                  ? t("rateLimits.networkPolicy.enforced")
                  : t("rateLimits.networkPolicy.notEnforced")}
              </Badge>
              <span className="text-muted-foreground">
                {t("rateLimits.networkPolicy.rules", {
                  allow: rules.filter((r) => r.action === "allow").length,
                  deny: rules.filter((r) => r.action === "deny").length,
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 p-4">
          <GaugeIcon className="size-5 text-amber-700 dark:text-amber-500" />
          <div className="text-sm">
            <p className="font-medium">{t("rateLimits.comingSoon.title")}</p>
            <p className="text-muted-foreground">{t("rateLimits.comingSoon.description")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
