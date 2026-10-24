import { Card, CardContent, CardDescription, CardHeader, CardTitle, TimeSince } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import { type OidcClient, useClientAuthFailures } from "../api/oidc-clients";
import { StatusPill } from "@/platform/components/status-pill";
import { formatDateTime } from "@/shared/utils/format";

/**
 * Renders a confidential application's wrong-secret attempts and any lockout, so an administrator
 * can see an attack and why an integration is failing.
 */
export function SecretFailuresCard({ client }: { client: OidcClient }) {
  const { t } = useTranslation("oidc");
  const q = useClientAuthFailures(client.id, client.type === "confidential");
  if (client.type !== "confidential") return null;
  const lockedUntil = q.data?.locked_until ?? null;
  const items = q.data?.items ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {t("detail.secretFailures.title")}
          {lockedUntil && (
            <StatusPill kind="danger">{t("detail.secretFailures.locked")}</StatusPill>
          )}
        </CardTitle>
        <CardDescription>{t("detail.secretFailures.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {q.isLoading ? null : q.isError ? (
          <p className="text-destructive">{t("detail.secretFailures.error")}</p>
        ) : (
          <>
            {lockedUntil && (
              <p>{t("detail.secretFailures.lockedUntil", { date: formatDateTime(lockedUntil) })}</p>
            )}
            {items.length === 0 ? (
              <p className="text-muted-foreground">{t("detail.secretFailures.none")}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {items.map((f) => (
                  <li
                    key={`${f.at}-${f.ip}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="font-mono text-xs">{f.ip || "—"}</span>
                    <TimeSince value={f.at} className="text-xs text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
