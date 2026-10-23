import { Badge, Card, CardContent, CardHeader, CardTitle, StatusPill } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import { type OidcClient, proofKeyStatus } from "../api/oidc-clients";
import { formatDate } from "@/shared/utils/format";

/**
 * Renders whether the app must send a proof key (PKCE) and a nonce, the rule for every app, or
 * holds an exemption, and until when.
 */
export function ProofKeyCard({ client }: { client: OidcClient }) {
  const { t } = useTranslation("oidc");
  const status = proofKeyStatus(client);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {t("detail.proofKey.title")}
          {status.kind === "exempt" && (
            <StatusPill kind={status.endingSoon ? "warning" : "info"}>
              {status.endingSoon ? t("detail.proofKey.endingSoon") : t("detail.proofKey.exempt")}
            </StatusPill>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {status.kind === "exempt" ? (
          <p>
            {t("detail.proofKey.exemptUntil", { date: formatDate(status.until.toISOString()) })}
          </p>
        ) : status.kind === "ended" ? (
          <p>{t("detail.proofKey.ended", { date: formatDate(status.until.toISOString()) })}</p>
        ) : (
          <p>{t("detail.proofKey.required")}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Marks an app exempt from sending a proof key, and one whose exemption ends soon, so an exemption
 * can't quietly become permanent or run out unnoticed.
 */
export function ProofKeyBadge({ client }: { client: OidcClient }) {
  const { t } = useTranslation("oidc");
  const status = proofKeyStatus(client);
  if (status.kind !== "exempt") return null;
  return (
    <Badge variant={status.endingSoon ? "destructive" : "secondary"}>
      {status.endingSoon ? t("table.pkceEndingSoon") : t("table.pkceExempt")}
    </Badge>
  );
}
