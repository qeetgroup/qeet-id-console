import { ArrowRightIcon } from "@qeetrix/icons";
import { Badge, Button, formatNumber } from "@qeetrix/react";
import { CopyButton, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import { getApiBaseUrl } from "@/platform/config/api-base-url";
import { useCapabilities } from "@/platform/security/capability-provider";
import { useSigningKeys } from "../api/signing-keys";
import { DevSection } from "./parts";
import "./developer.css";

const ENDPOINTS = ["issuer", "discovery", "jwks", "token", "agentToken", "verify"] as const;
const PATH: Record<(typeof ENDPOINTS)[number], string> = {
  issuer: "",
  discovery: "/.well-known/openid-configuration",
  jwks: "/.well-known/jwks.json",
  token: "/v1/oauth/token",
  agentToken: "/v1/agents/token",
  verify: "/v1/credentials/verify",
};

/**
 * Developer › Infrastructure: what integrations point at, read-only. The addresses every SDK and
 * machine credential uses, the key set that checks tokens, and an honest line on service health:
 * the server reports none to an organisation (only the deployment's own /readyz and /metrics).
 */
export function InfrastructurePage() {
  const { t } = useTranslation("developer");
  const access = useCapabilities();
  const keysQ = useSigningKeys();
  const origin = new URL(getApiBaseUrl()).origin;
  const published = keysQ.data?.keys.length;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("infrastructure.title")}
        description={t("infrastructure.description")}
      />
      <PageContent width="narrow">
        <div className="dev-record">
          <DevSection
            id="infra-endpoints"
            title={t("infrastructure.endpoints.title")}
            note={t("infrastructure.endpoints.note")}
          >
            <dl className="dev-endpoints">
              {ENDPOINTS.map((id) => {
                const url = `${origin}${PATH[id]}`;
                return (
                  <div key={id} className="dev-endpoint-row">
                    <dt>{t(`infrastructure.endpoints.${id}.label`)}</dt>
                    <dd>
                      <code className="dev-code dev-wrap">{url}</code>
                      <small>{t(`infrastructure.endpoints.${id}.what`)}</small>
                    </dd>
                    <dd className="dev-endpoint-copy">
                      <CopyButton
                        value={url}
                        variant="ghost"
                        label={t("infrastructure.endpoints.copy", {
                          name: t(`infrastructure.endpoints.${id}.label`),
                        })}
                      />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </DevSection>

          {access.can("connection.read") ? (
            <DevSection
              id="infra-keys"
              title={t("infrastructure.keys.title")}
              note={
                published === undefined
                  ? t("infrastructure.keys.loading")
                  : t("infrastructure.keys.note", {
                      count: published,
                      n: formatNumber(published, formatLocale()),
                    })
              }
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ArrowRightIcon}
                  render={<Link to="/auth/api/signing-keys" />}
                >
                  {t("infrastructure.keys.open")}
                </Button>
              }
            />
          ) : null}

          <DevSection
            id="infra-health"
            title={t("infrastructure.health.title")}
            action={
              <Badge tone="neutral" size="sm">
                {t("infrastructure.health.notReported")}
              </Badge>
            }
            note={t("infrastructure.health.note")}
          />
        </div>
      </PageContent>
    </>
  );
}
