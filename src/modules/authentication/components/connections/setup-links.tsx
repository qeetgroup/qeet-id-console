import { LinkIcon, TrashIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  Field,
  formatDateTime,
  formatRelativeTime,
  Heading,
  Select,
  Text,
} from "@qeetrix/react";
import { Alert, EmptyState } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type AdminPortalCapability,
  type AdminPortalLink,
  useAdminPortalLinks,
  useGenerateAdminPortalLink,
  useRevokeAdminPortalLink,
} from "@/modules/authentication/api/admin-portal";
import {
  DEFAULT_SETUP_LINK_TTL,
  SETUP_LINK_TTLS,
  setupLinkState,
} from "@/modules/authentication/connections-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { Section } from "./connection-parts";

const STATE_TONE = { active: "success", expired: "neutral", revoked: "neutral" } as const;

/**
 * Setup links (the admin portal): a link that lets the IT admin who runs the identity provider set
 * up SAML sign-in or the SCIM token, without a Qeet ID account. The server keeps a link for 15
 * minutes to 24 hours, shows it once, and checks it on every change, so revoking or its expiry
 * stops whoever holds it at once; each change it makes is in the audit log.
 */
export function SetupLinks({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation("connections");
  const locale = formatLocale();
  const runSensitive = useSensitiveAction();
  const linksQ = useAdminPortalLinks();
  const generateM = useGenerateAdminPortalLink();
  const revokeM = useRevokeAdminPortalLink();
  const [creating, setCreating] = useState(false);
  const [capabilities, setCapabilities] = useState<AdminPortalCapability[]>(["saml", "scim"]);
  const [ttl, setTtl] = useState(DEFAULT_SETUP_LINK_TTL);
  const [failure, setFailure] = useState<unknown>(null);
  const now = linksQ.dataUpdatedAt || Date.now();
  const links = [...(linksQ.data?.items ?? [])].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );
  const made = generateM.data;

  const create = () => {
    setFailure(null);
    void runSensitive({
      capability: "connection.write",
      actionLabel: t("links.create.action"),
      run: () => generateM.mutateAsync({ capabilities, ttl_seconds: ttl }),
    })
      .then((res) => res && setCreating(false))
      .catch((err: unknown) => {
        settleSensitiveAction(err);
        setFailure(err);
      });
  };
  const revoke = (link: AdminPortalLink) =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("links.revoke.title"),
        description: t("links.revoke.description"),
        confirmLabel: t("links.revoke.confirm"),
        tone: "destructive",
      },
      actionLabel: t("links.revoke.action"),
      run: () => revokeM.mutateAsync(link.id),
    }).catch(settleSensitiveAction);

  return (
    <div className="cx-links">
      <Section
        id="setup-links"
        title={t("links.title")}
        description={t("links.note")}
        action={
          canWrite && !creating ? (
            <Button variant="soft" tone="neutral" icon={LinkIcon} onClick={() => setCreating(true)}>
              {t("links.create.button")}
            </Button>
          ) : undefined
        }
      >
        {made ? (
          <OneTimeSecret
            title={t("links.made.title")}
            description={t("links.made.description", {
              when: formatDateTime(made.link.expires_at, locale),
            })}
            values={[{ value: made.url }]}
            dismissLabel={t("links.made.done")}
            onDismiss={() => generateM.reset()}
          />
        ) : null}
        {creating ? (
          <div className="account-panel">
            <div className="account-panel-head">
              <Heading level={3} size="title-sm">
                {t("links.create.title")}
              </Heading>
              <Text tone="subtle" size="sm">
                {t("links.create.note")}
              </Text>
            </div>
            <div className="account-panel-form">
              {failure ? (
                <Alert tone="danger" title={errorMessage(failure)}>
                  <ErrorReference error={failure} />
                </Alert>
              ) : null}
              <CheckboxGroup
                label={t("links.create.can")}
                value={capabilities}
                onValueChange={(values) => setCapabilities(values as AdminPortalCapability[])}
                error={capabilities.length ? undefined : t("links.create.pickOne")}
              >
                <Checkbox value="saml" label={t("links.saml")} description={t("links.samlNote")} />
                <Checkbox value="scim" label={t("links.scim")} description={t("links.scimNote")} />
              </CheckboxGroup>
              <Field label={t("links.create.expires")} description={t("links.create.expiresNote")}>
                <Select<string>
                  value={String(ttl)}
                  onValueChange={(v) => setTtl(Number(v ?? DEFAULT_SETUP_LINK_TTL))}
                  items={SETUP_LINK_TTLS.map((seconds) => ({
                    value: String(seconds),
                    label: t(
                      `links.ttl.${seconds === 3_600 ? "h1" : seconds === 14_400 ? "h4" : "h24"}`,
                    ),
                  }))}
                />
              </Field>
            </div>
            <span className="account-panel-actions">
              <Button
                icon={LinkIcon}
                loading={generateM.isPending}
                disabled={!capabilities.length}
                onClick={create}
              >
                {t("links.create.submit")}
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {t("parts.cancel")}
              </Button>
            </span>
          </div>
        ) : null}
        {links.length ? (
          <ul className="account-rows">
            {links.map((link) => {
              const state = setupLinkState(link, now);
              return (
                <li key={link.id} className="account-row">
                  <span className="account-icon" aria-hidden="true">
                    <LinkIcon />
                  </span>
                  <span className="account-row-text">
                    <span className="account-row-name">
                      <strong>
                        {link.capabilities
                          .map((c) => (c === "saml" ? t("links.saml") : t("links.scim")))
                          .join(" · ")}
                      </strong>
                      <Badge size="sm" tone={STATE_TONE[state]}>
                        {t(`links.state.${state}`)}
                      </Badge>
                    </span>
                    <small>
                      {state === "active"
                        ? t("links.expires", {
                            when: formatRelativeTime(Date.parse(link.expires_at), locale, now),
                          })
                        : t("links.madeOn", { date: formatDateTime(link.created_at, locale) })}
                      {" · "}
                      {link.last_used_at
                        ? t("links.used", {
                            when: formatRelativeTime(Date.parse(link.last_used_at), locale, now),
                          })
                        : t("links.unused")}
                    </small>
                  </span>
                  {canWrite && state === "active" ? (
                    <span className="account-row-actions">
                      <Button variant="ghost" icon={TrashIcon} onClick={() => void revoke(link)}>
                        {t("links.revoke.button")}
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : linksQ.data && !creating ? (
          <div className="cx-empty">
            <EmptyState
              size="section"
              title={t("links.emptyTitle")}
              description={t("links.emptyDescription")}
            />
          </div>
        ) : null}
      </Section>
    </div>
  );
}
