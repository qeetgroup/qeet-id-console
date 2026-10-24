import {
  Callout,
  Card,
  CardContent,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@qeetrix/ui";
import { LinkIcon, NetworkIcon, PlayIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/platform/components/status-pill";
import { formatDateTime } from "@/shared/utils/format";

import { socialStartUrl } from "../api/flows";
import { type SocialProvider, socialRedirectUri } from "../api/social";
import { CopyableUrlPanel, SectionHeading } from "./configure-social-provider-sheet-parts";
import type { SocialProviderMeta } from "./social-provider-catalogue";

/** Renders the sheet's advanced tab: the provider's sign-in URLs and what Qeet ID holds for it. */
export function SocialProviderAdvancedTab({
  provider,
  existing,
}: {
  provider: SocialProviderMeta;
  existing?: SocialProvider;
}) {
  const { t } = useTranslation("authentication");
  const redirectUri = socialRedirectUri(provider.id);
  const isEnabled = !!existing?.enabled;
  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <SectionHeading
            icon={<NetworkIcon className="size-4" />}
            title={t("social.configure.advanced.endpointsTitle")}
            subtitle={t("social.configure.advanced.endpointsSubtitle")}
          />
          <div className="grid gap-4">
            <CopyableUrlPanel
              icon={<LinkIcon className="size-3.5" />}
              title={t("social.configure.redirectTitle")}
              value={redirectUri}
              help={t("social.configure.advanced.redirectHelp")}
              copyLabel={t("social.configure.copyLabel")}
              copiedLabel={t("social.configure.copiedLabel")}
            />
            <CopyableUrlPanel
              icon={<PlayIcon className="size-3.5" />}
              title={t("social.configure.advanced.startTitle")}
              value={socialStartUrl(provider.id)}
              help={t("social.configure.advanced.startHelp")}
              copyLabel={t("social.configure.copyLabel")}
              copiedLabel={t("social.configure.copiedLabel")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <SectionHeading
            icon={<ShieldCheckIcon className="size-4" />}
            title={t("social.configure.advanced.statusTitle")}
            subtitle={t("social.configure.advanced.statusSubtitle")}
          />
          <DescriptionList>
            <DescriptionTerm>{t("social.configure.advanced.state")}</DescriptionTerm>
            <DescriptionDetails>
              {existing ? (
                <StatusPill kind={isEnabled ? "success" : "muted"}>
                  {isEnabled ? t("social.configure.stateOn") : t("social.configure.stateOff")}
                </StatusPill>
              ) : (
                <StatusPill kind="muted">{t("social.badges.notConfigured")}</StatusPill>
              )}
            </DescriptionDetails>
            <DescriptionTerm>{t("social.configure.advanced.requestedScopes")}</DescriptionTerm>
            <DescriptionDetails className="font-mono text-xs">
              openid email profile
            </DescriptionDetails>
            {existing && (
              <>
                <DescriptionTerm>{t("social.configure.clientIdLabel")}</DescriptionTerm>
                <DescriptionDetails className="break-all font-mono text-xs">
                  {existing.client_id}
                </DescriptionDetails>
                <DescriptionTerm>{t("social.configure.discoveryLabel")}</DescriptionTerm>
                <DescriptionDetails className="break-all font-mono text-xs">
                  {existing.discovery_url || "—"}
                </DescriptionDetails>
                <DescriptionTerm>{t("social.configure.advanced.updated")}</DescriptionTerm>
                <DescriptionDetails>{formatDateTime(existing.updated_at)}</DescriptionDetails>
              </>
            )}
          </DescriptionList>
          <Callout variant="warning" className="text-xs">
            {t("social.configure.advanced.lifecycleNote")}
          </Callout>
        </CardContent>
      </Card>
    </>
  );
}
