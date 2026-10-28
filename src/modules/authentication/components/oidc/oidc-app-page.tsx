import {
  AppWindowIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  PencilIcon,
  RefreshCwIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDate,
  formatNumber,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Skeleton,
  Tab,
  Tabs,
  TabsList,
} from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  PageHeaderBack,
} from "@qeetrix/react/experimental";
import { Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { useOAuthGrants } from "@/modules/authentication/api/oauth-grants";
import {
  type OidcClient,
  useDeleteOidcClient,
  useOidcClients,
  useRotateClientSecret,
} from "@/modules/authentication/api/oidc-clients";
import { appKind, peopleByClient, signsInAt } from "@/modules/authentication/oidc-apps-model";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { OidcAppDrawer } from "./oidc-app-drawer";
import { Integrate, Overview } from "./oidc-app-sections";
import { testSignIn } from "./oidc-snippets";
import "@/modules/authentication/components/connections/connections.css";

export type AppTab = "overview" | "integrate";

/**
 * One application, found by its client ID or row ID. Overview: what needs attention first (its
 * exemption from the proof key), then its credentials, where it signs people in, what protects
 * its sign-ins, how it looks on the hosted sign-in page, and deleting it. Integrate: Qeet ID's
 * endpoints and a sign-in snippet filled in with its values.
 */
export function OidcAppPage({
  clientId,
  tab,
  onTabChange,
}: {
  clientId: string;
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}) {
  const { t } = useTranslation("oidc");
  const listQ = useOidcClients();
  const client = listQ.data?.items.find((c) => c.client_id === clientId || c.id === clientId);

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
  if (!client)
    return (
      <>
        <PageHeader
          back={
            <PageHeaderBack render={<RouterLink to="/auth/connections/oidc" />}>
              {t("app.back")}
            </PageHeaderBack>
          }
          title={t("app.notFound.title")}
        />
        <PageContent>
          <EmptyState
            icon={AppWindowIcon}
            title={t("app.notFound.title")}
            description={t("app.notFound.description", { clientId })}
          />
        </PageContent>
      </>
    );
  return <AppRecord client={client} tab={tab} onTabChange={onTabChange} />;
}

function AppRecord({
  client: c,
  tab,
  onTabChange,
}: {
  client: OidcClient;
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
}) {
  const { t } = useTranslation("oidc");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const navigate = useNavigate();
  const canWrite = useCapabilities().can("connection.write");
  const runSensitive = useSensitiveAction();
  const rotateM = useRotateClientSecret(c.id);
  const deleteM = useDeleteOidcClient();
  const grantsQ = useOAuthGrants();
  const [editing, setEditing] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const people = peopleByClient(grantsQ.data?.items ?? []).get(c.client_id) ?? 0;
  const at = signsInAt(c);

  const rotate = () =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("app.rotate.title", { name: c.name }),
        description: t("app.rotate.description", { name: c.name }),
        confirmLabel: t("app.rotate.confirm"),
        tone: "destructive",
      },
      actionLabel: t("app.rotate.action"),
      run: () => rotateM.mutateAsync(),
    })
      .then((res) => {
        if (res) {
          setSecret(res.client_secret);
          onTabChange("overview");
        }
      })
      .catch(settleSensitiveAction);

  const remove = () =>
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("delete.title", { name: c.name }),
        description: t("delete.description", { name: c.name }),
        confirmLabel: t("delete.confirm"),
        tone: "destructive",
      },
      actionLabel: t("delete.action"),
      run: () => deleteM.mutateAsync(c.id),
    })
      .then(() => navigate({ to: "/auth/connections/oidc" }))
      .catch(settleSensitiveAction);

  const test = () =>
    void testSignIn(c).then((opened) => {
      if (!opened)
        toast.error(t("app.test.noRedirect"), { description: t("app.test.noRedirectText") });
    });

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value === "integrate" ? "integrate" : "overview")}
    >
      <PageHeader
        back={
          <PageHeaderBack render={<RouterLink to="/auth/connections/oidc" />}>
            {t("app.back")}
          </PageHeaderBack>
        }
        title={c.name}
        status={
          <Badge tone="neutral">
            {c.type === "confidential" ? t("type.confidential") : t("type.public")}
          </Badge>
        }
        description={[
          at ? t("app.kindAt", { kind: t(`kinds.${appKind(c)}`), at }) : t(`kinds.${appKind(c)}`),
          grantsQ.data ? t("app.people", { count: people, n: n(people) }) : null,
          t("app.created", { date: formatDate(c.created_at, locale, { dateStyle: "medium" }) }),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {canWrite ? (
              <Menu>
                <MenuTrigger
                  render={
                    <IconButton
                      icon={EllipsisIcon}
                      aria-label={t("app.more")}
                      variant="ghost"
                      tone="neutral"
                    />
                  }
                />
                <MenuContent align="end">
                  <MenuItem icon={PencilIcon} onClick={() => setEditing(true)}>
                    {t("app.edit")}
                  </MenuItem>
                  {c.type === "confidential" ? (
                    <MenuItem icon={RefreshCwIcon} onClick={() => void rotate()}>
                      {t("app.rotate.button")}
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  <MenuItem icon={TrashIcon} tone="danger" onClick={() => void remove()}>
                    {t("delete.button")}
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : null}
            <Button icon={ExternalLinkIcon} disabled={!c.redirect_uris.length} onClick={test}>
              {t("app.test.button")}
            </Button>
          </>
        }
        tabs={
          <TabsList activateOnFocus={false} aria-label={t("app.views")}>
            <Tab value="overview">{t("app.overview")}</Tab>
            <Tab value="integrate">{t("app.integrate")}</Tab>
          </TabsList>
        }
      />
      <PageContent>
        <div className="cx-detail">
          {tab === "integrate" ? (
            <Integrate client={c} />
          ) : (
            <Overview
              client={c}
              canWrite={canWrite}
              secret={secret}
              rotating={rotateM.isPending}
              onDismissSecret={() => {
                setSecret(null);
                rotateM.reset();
              }}
              onRotate={() => void rotate()}
              onEdit={() => setEditing(true)}
              onDelete={() => void remove()}
              onSeeIntegrate={() => onTabChange("integrate")}
            />
          )}
        </div>
      </PageContent>
      <OidcAppDrawer open={editing} onOpenChange={setEditing} client={c} />
    </Tabs>
  );
}
