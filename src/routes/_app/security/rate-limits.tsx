import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@qeetrix/ui";
import { errorMessage } from "@/platform/errors/user-message";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GaugeIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { useIpRules } from "@/modules/security/api/ip-allowlist";

export const Route = createFileRoute("/_app/security/rate-limits")({
  component: RateLimitsPage,
});

// These are the per-IP defaults baked into platform/cache/ratelimit/limiter.go.
// Per-tenant / per-user / per-api-key overrides now ship backend-side
// (migration 0064_rate_limit_overrides, domains/operations/ratelimits); this
// admin screen isn't wired to that override API yet.
const STATIC_LIMITS: { endpoint: string; limit: string; window: string }[] = [
  {
    endpoint: "POST /v1/auth/login",
    limit: "5 req / 20 burst",
    window: "per IP, sliding",
  },
  {
    endpoint: "POST /v1/auth/refresh",
    limit: "5 req / 20 burst",
    window: "per IP, sliding",
  },
  {
    endpoint: "POST /v1/auth/signup",
    limit: "5 req / 20 burst",
    window: "per IP, sliding",
  },
  {
    endpoint: "POST /v1/auth/forgot-password",
    limit: "5 req / 20 burst",
    window: "per IP, sliding",
  },
  {
    endpoint: "POST /v1/oauth/token (client_credentials)",
    limit: "5 req / 20 burst",
    window: "per IP, sliding",
  },
  { endpoint: "Other authed endpoints", limit: "unlimited", window: "—" },
];

function RateLimitsPage() {
  const { t } = useTranslation("security");
  // Which networks may sign in is the IP rules' job; this page only points there.
  const rulesQ = useIpRules();
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
            <div key={row.endpoint} className="flex items-center justify-between gap-4 p-3 text-sm">
              <code className="text-xs">{row.endpoint}</code>
              <div className="flex items-center gap-2">
                <Badge variant="muted">{row.limit}</Badge>
                <span className="text-xs text-muted-foreground">{row.window}</span>
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
            <div className="text-sm text-destructive">{errorMessage(rulesQ.error)}</div>
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
