// An application page's two tabs: Overview and Integrate (oidc-app-page.tsx).
import { CircleAlertIcon, TrashIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  Link,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { Alert, CodeBlock, CopyButton } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type OidcClient,
  proofKeyStatus,
  useClientAuthFailures,
} from "@/modules/authentication/api/oidc-clients";
import {
  applicationHomePage,
  applicationLogo,
} from "@/modules/authentication/application-presentation-model";
import {
  CopyRow,
  DangerZone,
  Detail,
  Mono,
  None,
  Section,
} from "@/modules/authentication/components/connections/connection-parts";
import { grantWord } from "@/modules/authentication/oidc-apps-model";
import { OneTimeSecret } from "@/shared/components/one-time-secret";
import {
  endpoints,
  FRAMEWORK_NAMES,
  FRAMEWORKS,
  type Framework,
  SNIPPET_FILE,
  snippet,
} from "./oidc-snippets";

export function Overview({
  client: c,
  canWrite,
  secret,
  rotating,
  onDismissSecret,
  onRotate,
  onEdit,
  onDelete,
  onSeeIntegrate,
}: {
  client: OidcClient;
  canWrite: boolean;
  onSeeIntegrate: () => void;
  secret: string | null;
  rotating: boolean;
  onDismissSecret: () => void;
  onRotate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("oidc");
  const locale = formatLocale();
  const proof = proofKeyStatus(c);
  const failuresQ = useClientAuthFailures(c.id, c.type === "confidential");
  const logo = applicationLogo(c.logo_uri);
  const home = applicationHomePage(c.client_uri);
  const editAction = canWrite ? (
    <Button variant="ghost" onClick={onEdit}>
      {t("app.edit")}
    </Button>
  ) : undefined;
  const failures = failuresQ.data;

  return (
    <>
      {proof.kind !== "required" ? (
        <Alert
          className="cx-alert"
          tone={proof.kind === "ended" ? "danger" : "warning"}
          icon={CircleAlertIcon}
          actions={
            <Button variant="soft" tone="neutral" size="sm" onClick={onSeeIntegrate}>
              {t("app.pkce.see")}
            </Button>
          }
          title={
            proof.kind === "ended"
              ? t("app.pkce.endedTitle", {
                  date: formatDate(proof.until, locale, { dateStyle: "long" }),
                })
              : t("app.pkce.exemptTitle", {
                  date: formatDate(proof.until, locale, { dateStyle: "long" }),
                })
          }
        >
          {proof.kind === "ended"
            ? t("app.pkce.endedText", { name: c.name })
            : t("app.pkce.exemptText", { name: c.name })}
        </Alert>
      ) : null}

      <Section
        id="app-credentials"
        title={t("app.credentials.title")}
        description={t("app.credentials.note")}
      >
        {secret ? (
          <OneTimeSecret
            title={t("app.rotate.madeTitle")}
            description={t("app.rotate.madeDescription")}
            values={[{ label: "client_secret=", value: secret }]}
            dismissLabel={t("drawer.done")}
            onDismiss={onDismissSecret}
          />
        ) : null}
        <dl className="account-details">
          <Detail
            label={t("app.credentials.clientId")}
            action={
              <CopyButton value={c.client_id} label={t("app.credentials.copyClientId")}>
                {t("app.credentials.copy")}
              </CopyButton>
            }
          >
            <Mono>{c.client_id}</Mono>
          </Detail>
          {c.type === "confidential" ? (
            <Detail
              label={t("app.credentials.secret")}
              hint={t("app.credentials.secretHint")}
              action={
                canWrite ? (
                  <Button variant="ghost" loading={rotating} onClick={onRotate}>
                    {t("app.rotate.short")}
                  </Button>
                ) : undefined
              }
            >
              {t("app.credentials.secretSet")}
            </Detail>
          ) : null}
          <Detail
            label={t("app.credentials.type")}
            hint={
              c.type === "confidential"
                ? t("app.credentials.confidentialHint")
                : t("app.credentials.publicHint")
            }
          >
            {c.type === "confidential" ? t("type.confidential") : t("type.public")}
          </Detail>
        </dl>
      </Section>

      <Section id="app-sign-in" title={t("app.signIn.title")} description={t("app.signIn.note")}>
        <dl className="account-details">
          <Detail
            label={t("app.signIn.redirects")}
            hint={t("app.signIn.redirectsHint")}
            action={editAction}
          >
            {c.redirect_uris.length ? (
              <span className="cx-list">
                {c.redirect_uris.map((u) => (
                  <Mono key={u}>{u}</Mono>
                ))}
              </span>
            ) : (
              <None>{t("app.signIn.none")}</None>
            )}
          </Detail>
          <Detail label={t("app.signIn.afterSignOut")} action={editAction}>
            {c.post_logout_uris?.length ? (
              <span className="cx-list">
                {c.post_logout_uris.map((u) => (
                  <Mono key={u}>{u}</Mono>
                ))}
              </span>
            ) : (
              <None>{t("app.signIn.none")}</None>
            )}
          </Detail>
          <Detail label={t("app.signIn.grants")} action={editAction}>
            {c.grant_types
              .map((g) => {
                const word = grantWord(g);
                return word === "other" ? g : t(`grants.${word}`);
              })
              .join(", ") || <None>{t("app.signIn.none")}</None>}
          </Detail>
          <Detail label={t("app.signIn.scopes")} action={editAction}>
            <span className="cx-inline">
              {c.scopes.map((s) => (
                <Badge key={s} size="sm">
                  {s}
                </Badge>
              ))}
            </span>
          </Detail>
        </dl>
      </Section>

      <Section
        id="app-security"
        title={t("app.security.title")}
        description={t("app.security.note")}
      >
        <dl className="account-details">
          <Detail
            label={t("app.security.pkce")}
            hint={
              proof.kind === "exempt"
                ? t("app.security.pkceExemptHint")
                : proof.kind === "ended"
                  ? t("app.security.pkceEndedHint")
                  : t("app.security.pkceRequiredHint")
            }
          >
            {proof.kind === "required" ? (
              t("app.security.pkceRequired")
            ) : (
              <span className="cx-inline">
                {proof.kind === "exempt"
                  ? t("app.security.pkceOffUntil", {
                      date: formatDate(proof.until, locale, { dateStyle: "medium" }),
                    })
                  : t("app.security.pkceEnded", {
                      date: formatDate(proof.until, locale, { dateStyle: "medium" }),
                    })}
                {proof.kind === "exempt" ? (
                  <Badge tone="warning" size="sm">
                    {t("app.security.ends", {
                      when: formatRelativeTime(proof.until, locale, Date.now()),
                    })}
                  </Badge>
                ) : null}
              </span>
            )}
          </Detail>
          {c.type === "confidential" ? (
            <Detail
              label={t("app.security.wrongSecrets")}
              hint={t("app.security.wrongSecretsHint")}
            >
              {failuresQ.isError ? (
                <None>{t("app.security.wrongSecretsError")}</None>
              ) : !failures ? (
                <None>—</None>
              ) : failures.locked_until ? (
                <span className="cx-inline">
                  {t("app.security.lockedUntil", {
                    date: formatDateTime(failures.locked_until, locale),
                  })}
                  <Badge tone="danger" size="sm">
                    {t("app.security.locked")}
                  </Badge>
                </span>
              ) : failures.items.length ? (
                t("app.security.recent", {
                  count: failures.items.length,
                  when: formatRelativeTime(
                    Date.parse(failures.items[0]?.at ?? new Date().toISOString()),
                    locale,
                    Date.now(),
                  ),
                })
              ) : (
                t("app.security.noneRecently")
              )}
            </Detail>
          ) : null}
        </dl>
      </Section>

      <Section id="app-page" title={t("app.look.title")} description={t("app.look.note")}>
        <dl className="account-details">
          <Detail label={t("app.look.logo")} action={editAction}>
            {logo ? <Mono>{c.logo_uri}</Mono> : <None>{t("app.look.notSet")}</None>}
          </Detail>
          <Detail
            label={t("app.look.home")}
            hint={home ? t("app.look.homeHint", { host: home.host }) : undefined}
            action={editAction}
          >
            {home ? (
              <Link href={home.href} target="_blank" rel="noreferrer">
                {home.host}
              </Link>
            ) : (
              <None>{t("app.look.notSet")}</None>
            )}
          </Detail>
        </dl>
      </Section>

      {canWrite ? (
        <DangerZone title={t("app.danger.title")} description={t("app.danger.note")}>
          <Button tone="danger" icon={TrashIcon} onClick={onDelete}>
            {t("delete.button")}
          </Button>
        </DangerZone>
      ) : null}
    </>
  );
}

export function Integrate({ client: c }: { client: OidcClient }) {
  const { t } = useTranslation("oidc");
  const [fw, setFw] = useState<Framework>("nextjs");
  const e = endpoints();
  return (
    <>
      <Section
        id="app-endpoints"
        title={t("app.endpoints.title")}
        description={t("app.endpoints.note")}
      >
        <dl className="account-details">
          <CopyRow
            label={t("app.endpoints.issuer")}
            value={e.issuer}
            copyLabel={t("app.endpoints.copyIssuer")}
          />
          <CopyRow
            label={t("app.endpoints.discovery")}
            value={e.discovery}
            copyLabel={t("app.endpoints.copyDiscovery")}
          />
          <CopyRow
            label={t("app.endpoints.authorize")}
            value={e.authorize}
            copyLabel={t("app.endpoints.copyAuthorize")}
          />
          <CopyRow
            label={t("app.endpoints.token")}
            value={e.token}
            copyLabel={t("app.endpoints.copyToken")}
          />
          <CopyRow
            label={t("app.endpoints.userinfo")}
            value={e.userinfo}
            copyLabel={t("app.endpoints.copyUserinfo")}
          />
          <CopyRow
            label={t("app.endpoints.jwks")}
            value={e.jwks}
            copyLabel={t("app.endpoints.copyJwks")}
          />
        </dl>
      </Section>
      <Section
        id="app-snippet"
        title={t("app.snippet.title")}
        description={
          c.type === "confidential"
            ? t("app.snippet.noteConfidential")
            : t("app.snippet.notePublic")
        }
        action={
          <ToggleGroup
            aria-label={t("app.snippet.framework")}
            value={[fw]}
            onValueChange={(values) => {
              const next = values[0];
              if (next && (FRAMEWORKS as readonly string[]).includes(next))
                setFw(next as Framework);
            }}
          >
            {FRAMEWORKS.map((f) => (
              <Toggle key={f} value={f}>
                {FRAMEWORK_NAMES[f]}
              </Toggle>
            ))}
          </ToggleGroup>
        }
      >
        <CodeBlock
          code={snippet(fw, c)}
          language={fw === "go" ? "text" : fw === "react" ? "tsx" : "typescript"}
          title={SNIPPET_FILE[fw]}
        />
        <p className="cx-flow-note">
          {c.redirect_uris[0]
            ? t("app.snippet.testNote", { uri: c.redirect_uris[0] })
            : t("app.snippet.testNoteNone")}
        </p>
      </Section>
    </>
  );
}
