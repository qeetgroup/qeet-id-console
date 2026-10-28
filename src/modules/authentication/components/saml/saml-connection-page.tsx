import {
  CircleAlertIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  TrashIcon,
  WorkflowIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatRelativeTime,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
} from "@qeetrix/react";
import { Alert, DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type SamlConnection,
  type SamlTestResult,
  samlAcsUrl,
  samlLoginUrl,
  samlMetadataUrl,
  useSamlConnections,
  useTestSamlConnection,
} from "@/modules/authentication/api/saml";
import {
  fingerprint,
  readCertificate,
  shortFingerprint,
} from "@/modules/authentication/certificate-model";
import { certificateEnding, connectionStatus } from "@/modules/authentication/connections-model";
import {
  CopyRow,
  DangerZone,
  Detail,
  Mono,
  None,
  Section,
  SetupLayout,
  StatusBadge,
} from "@/modules/authentication/components/connections/connection-parts";
import { SAML_IDP_VENDOR_LABELS, samlIdpVendor } from "@/modules/authentication/saml-vendors";
import { FeatureGate } from "@/modules/billing";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { SamlDrawer } from "./saml-drawer";
import { SamlTurnOn } from "./saml-turn-on";
import { useSamlActions } from "./use-saml-actions";
import "@/modules/authentication/components/connections/connections.css";

const DAY = 86_400_000;

/**
 * One SAML sign-in connection (Authentication › SSO › SAML): its setup, step by step. Who the
 * identity provider is; what to give it (Qeet ID's ACS URL and entity ID, which carry this
 * connection's ID); its details as stored, with the certificate read in the browser (whom it
 * names, when it ends, its fingerprint); the attributes that become a person's email and name;
 * the server's checks, the status, whether a sign-in the provider starts is accepted; deleting.
 */
export function SamlConnectionPage({ id }: { id: string }) {
  const { t } = useTranslation("saml");
  const access = useCapabilities();
  const listQ = useSamlConnections();
  const connection = listQ.data?.items.find((c) => c.id === id);

  if (listQ.isError)
    return (
      <PageContent>
        <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
      </PageContent>
    );
  if (!listQ.data)
    return (
      <PageContent>
        <Skeleton lines={8} />
      </PageContent>
    );
  if (!connection)
    return (
      <>
        <PageHeader breadcrumb={<PageBreadcrumb />} title={t("signIn.notFound.title")} />
        <PageContent>
          <EmptyState
            icon={WorkflowIcon}
            title={t("signIn.notFound.title")}
            description={t("signIn.notFound.description")}
            actions={
              <Button
                variant="soft"
                tone="neutral"
                render={<RouterLink to="/auth/connections/saml" />}
              >
                {t("signIn.notFound.back")}
              </Button>
            }
          />
        </PageContent>
      </>
    );
  return <SamlRecord connection={connection} canWrite={access.can("connection.write")} />;
}

function SamlRecord({
  connection: c,
  canWrite,
}: {
  connection: SamlConnection;
  canWrite: boolean;
}) {
  const { t } = useTranslation("saml");
  const locale = formatLocale();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((o) => o.id === tenantId)?.name ?? t("signIn.yourOrg");
  const actions = useSamlActions();
  const testM = useTestSamlConnection();
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState<{ result: SamlTestResult; at: number } | null>(null);
  const [print, setPrint] = useState<string | null>(null);

  const vendor = samlIdpVendor(c);
  const provider = vendor === "other" ? t("signIn.theProvider") : SAML_IDP_VENDOR_LABELS[vendor];
  const cert = useMemo(() => readCertificate(c.idp_certificate), [c.idp_certificate]);
  useEffect(() => {
    let live = true;
    if (cert) void fingerprint(cert.der).then((f) => live && setPrint(f));
    return () => {
      live = false;
    };
  }, [cert]);
  const now = Date.now();
  const ending = c.status !== "disabled" && certificateEnding(cert?.notAfter, now);
  const ended = !!cert && cert.notAfter.getTime() <= now;
  const status = connectionStatus(c.status, ending || (checked ? !checked.result.ok : false));
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), locale, now);
  const days = cert ? Math.ceil((cert.notAfter.getTime() - now) / DAY) : 0;

  const runChecks = () =>
    testM.mutateAsync(c.id).then(
      (result) => setChecked({ result, at: Date.now() }),
      () => setChecked(null),
    );

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={c.name}
        status={<StatusBadge status={status} />}
        description={
          c.last_login_at
            ? t("signIn.page.descriptionUsed", { org, when: ago(c.last_login_at) })
            : t("signIn.page.description", { org })
        }
        actions={
          <>
            {canWrite ? (
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      icon={EllipsisIcon}
                      aria-label={t("signIn.page.more")}
                      variant="ghost"
                      tone="neutral"
                    />
                  }
                />
                <MenuContent align="end">
                  <MenuItem icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("signIn.page.edit")}
                  </MenuItem>
                  <MenuItem
                    icon={PlusIcon}
                    onClick={() =>
                      void navigate({ to: "/auth/connections/saml", search: { action: "create" } })
                    }
                  >
                    {t("signIn.page.new")}
                  </MenuItem>
                  {c.status === "active" ? (
                    <MenuItem icon={PowerIcon} onClick={() => void actions.setOn(c, false)}>
                      {t("signIn.off.button")}
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem icon={TrashIcon} tone="danger" onClick={() => void actions.remove(c)}>
                    {t("signIn.delete.button")}
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
            {c.status === "active" ? (
              <Button
                icon={ExternalLinkIcon}
                render={<a href={samlLoginUrl(c.id)} target="_blank" rel="noreferrer" />}
              >
                {t("signIn.page.test")}
              </Button>
            ) : null}
            {canWrite && c.status !== "active" ? (
              <Button
                icon={PowerIcon}
                loading={actions.pending}
                onClick={() => void actions.setOn(c, true)}
              >
                {t("signIn.on.button")}
              </Button>
            ) : null}
          </>
        }
        tabs={
          <PageTabs>
            <PageTabList />
          </PageTabs>
        }
      />
      <PageContent>
        <FeatureGate
          feature="sso"
          title={t("signIn.gate.title")}
          description={t("signIn.gate.description")}
        >
          <SetupLayout
            label={t("signIn.steps.label")}
            current={c.status === "active" ? 5 : 4}
            steps={[
              { label: t("signIn.steps.provider"), description: provider },
              { label: t("signIn.steps.ours"), description: t("signIn.steps.oursNote") },
              {
                label: t("signIn.steps.theirs", { provider }),
                description: cert
                  ? t("signIn.steps.theirsNote", {
                      date: formatDate(cert.notAfter, locale, { dateStyle: "medium" }),
                    })
                  : undefined,
              },
              {
                label: t("signIn.steps.attributes"),
                description: [c.email_attribute, c.name_attribute].filter(Boolean).join(" · "),
              },
              {
                label: t("signIn.steps.turnOn"),
                description:
                  c.status === "active"
                    ? c.last_login_at
                      ? t("signIn.steps.onUsed", { when: ago(c.last_login_at) })
                      : t("signIn.steps.on")
                    : t(`signIn.status.word.${c.status}`),
              },
            ]}
          >
            {!canWrite ? (
              <Alert
                className="cx-alert"
                tone="info"
                icon={EyeIcon}
                title={t("signIn.readOnly.title")}
              >
                {t("signIn.readOnly.description")}
              </Alert>
            ) : null}
            {ending ? (
              <Alert
                className="cx-alert"
                tone={ended ? "danger" : "warning"}
                icon={CircleAlertIcon}
                title={
                  ended
                    ? t("signIn.certificate.endedTitle", { provider })
                    : t("signIn.certificate.endingTitle", { provider, count: days })
                }
                actions={
                  canWrite ? (
                    <Button
                      variant="soft"
                      tone="neutral"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      {t("signIn.certificate.replace")}
                    </Button>
                  ) : undefined
                }
              >
                {t("signIn.certificate.endingDescription", {
                  provider,
                  date: formatDate(cert?.notAfter ?? now, locale, { dateStyle: "long" }),
                })}
              </Alert>
            ) : null}

            <Section
              id="saml-provider"
              title={t("signIn.provider.title")}
              description={t("signIn.provider.note")}
            >
              <dl className="account-details">
                <Detail
                  label={t("signIn.provider.name")}
                  action={
                    canWrite ? (
                      <Button variant="ghost" onClick={() => setEditing(true)}>
                        {t("signIn.provider.rename")}
                      </Button>
                    ) : undefined
                  }
                >
                  {c.name}
                </Detail>
                <Detail label={t("signIn.provider.kind")} hint={t("signIn.provider.kindHint")}>
                  {vendor === "other" ? t("signIn.provider.other") : provider}
                </Detail>
              </dl>
            </Section>

            <Section
              id="saml-ours"
              title={t("signIn.ours.title", { provider })}
              description={t("signIn.ours.note", { provider })}
            >
              <dl className="account-details">
                <CopyRow
                  label={t("signIn.ours.acs")}
                  value={samlAcsUrl(c.id)}
                  hint={t("signIn.ours.acsHint", { provider })}
                  copyLabel={t("signIn.ours.copyAcs")}
                />
                <CopyRow
                  label={t("signIn.ours.entity")}
                  value={samlMetadataUrl(c.id)}
                  hint={t("signIn.ours.entityHint", { provider })}
                  copyLabel={t("signIn.ours.copyEntity")}
                />
                <Detail
                  label={t("signIn.ours.nameId")}
                  hint={t("signIn.ours.nameIdHint", { attribute: c.email_attribute || "email" })}
                >
                  {t("signIn.ours.nameIdValue")}
                </Detail>
                <Detail
                  label={t("signIn.ours.metadata")}
                  hint={t("signIn.ours.metadataHint")}
                  action={
                    <Button
                      variant="ghost"
                      icon={DownloadIcon}
                      render={<a href={samlMetadataUrl(c.id)} target="_blank" rel="noreferrer" />}
                    >
                      {t("signIn.ours.open")}
                    </Button>
                  }
                >
                  <Mono>{t("signIn.ours.metadataFile")}</Mono>
                </Detail>
              </dl>
            </Section>

            <Section
              id="saml-theirs"
              title={t("signIn.theirs.title", { provider })}
              description={t("signIn.theirs.note", { provider })}
              action={
                canWrite ? (
                  <Button variant="ghost" icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("signIn.theirs.update")}
                  </Button>
                ) : undefined
              }
            >
              <dl className="account-details">
                <Detail label={t("signIn.theirs.ssoUrl")}>
                  <Mono>{c.idp_sso_url}</Mono>
                </Detail>
                <Detail label={t("signIn.theirs.entity")}>
                  <Mono>{c.idp_entity_id}</Mono>
                </Detail>
                <Detail
                  label={t("signIn.theirs.certificate")}
                  hint={
                    print
                      ? t("signIn.theirs.fingerprint", { print: shortFingerprint(print) })
                      : undefined
                  }
                >
                  {cert ? (
                    <span className="cx-inline" title={print ?? undefined}>
                      {t("signIn.theirs.certificateValue", {
                        subject: cert.subject || provider,
                        date: formatDate(cert.notAfter, locale, { dateStyle: "medium" }),
                      })}
                      {ended ? (
                        <Badge tone="danger" size="sm">
                          {t("signIn.theirs.ended")}
                        </Badge>
                      ) : ending ? (
                        <Badge tone="warning" size="sm">
                          {t("signIn.theirs.endsIn", { count: days })}
                        </Badge>
                      ) : (
                        <Badge tone="success" size="sm">
                          {t("signIn.theirs.valid")}
                        </Badge>
                      )}
                    </span>
                  ) : (
                    <None>{t("signIn.theirs.unreadable")}</None>
                  )}
                </Detail>
              </dl>
            </Section>

            <Section
              id="saml-attributes"
              title={t("signIn.attributes.title")}
              description={t("signIn.attributes.note", { provider })}
              action={
                canWrite ? (
                  <Button variant="ghost" icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("signIn.attributes.edit")}
                  </Button>
                ) : undefined
              }
            >
              <dl className="account-details">
                <Detail
                  label={t("signIn.attributes.email")}
                  hint={t("signIn.attributes.emailHint")}
                >
                  {c.email_attribute ? (
                    <Mono>{c.email_attribute}</Mono>
                  ) : (
                    <None>{t("signIn.attributes.nameIdOnly")}</None>
                  )}
                </Detail>
                <Detail label={t("signIn.attributes.name")} hint={t("signIn.attributes.nameHint")}>
                  {c.name_attribute ? (
                    <Mono>{c.name_attribute}</Mono>
                  ) : (
                    <None>{t("signIn.attributes.notSent")}</None>
                  )}
                </Detail>
                <Detail label={t("signIn.attributes.newPeople")}>
                  {t("signIn.attributes.newPeopleText", { org })}
                </Detail>
              </dl>
            </Section>

            <SamlTurnOn
              connection={c}
              canWrite={canWrite}
              provider={provider}
              checked={checked}
              running={testM.isPending}
              onRun={() => void runChecks()}
              notAfter={cert?.notAfter}
              onSetOn={(on) => void actions.setOn(c, on)}
              onSetIdpInitiated={(allow) => void actions.setIdpInitiated(c, allow)}
            />

            {canWrite ? (
              <DangerZone
                title={t("signIn.delete.zoneTitle")}
                description={
                  c.status === "active"
                    ? t("signIn.delete.zoneOn", { name: c.name })
                    : t("signIn.delete.zoneOff")
                }
              >
                <Button tone="danger" icon={TrashIcon} onClick={() => void actions.remove(c)}>
                  {t("signIn.delete.confirm")}
                </Button>
              </DangerZone>
            ) : null}
          </SetupLayout>
        </FeatureGate>
      </PageContent>
      <SamlDrawer open={editing} onOpenChange={setEditing} connection={c} />
    </>
  );
}
