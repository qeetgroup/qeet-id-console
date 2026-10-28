import { RefreshCwIcon } from "@qeetrix/icons";
import { Badge, Button, Skeleton } from "@qeetrix/react";
import { Alert, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb } from "@/modules/dashboard";
import { qeetaiKeys } from "@/modules/qeetai/api/keys";
import {
  deleteQeetAIProviderConfig,
  setQeetAIProviderConfig,
  testQeetAIProviderConfig,
} from "@/modules/qeetai/api/provider-config";
import {
  type QeetAIProviderConfig,
  type QeetAIStatus,
  useQeetAIProviderConfig,
  useQeetAIStatus,
} from "@/modules/qeetai/api/qeetai";
import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import type { ProviderActions } from "./provider-form";
import { ProviderSection } from "./provider-section";
import { Detail, Section } from "./settings-parts";
import "./qeetai-settings.css";

export type ProviderSettingsViewProps = ProviderActions & {
  config?: QeetAIProviderConfig;
  /** Whether Qeet AI is on, from the server (it also weighs the plan). */
  status?: QeetAIStatus;
  loading: boolean;
  error?: unknown;
  fetching: boolean;
  canRead: boolean;
  canWrite: boolean;
  onRetry: () => unknown;
  onRemove: () => Promise<void>;
};

/**
 * Settings › Qeet AI: whether the assistant is on and the provider it runs on, with the way to
 * connect, change or remove the organisation's own key, and what leaves Qeet ID. Saving and
 * removing need a recent second factor (the server's step-up); every write is the organisation's,
 * so a switch of organisation drops a half-typed key.
 */
export function QeetAISettingsPage() {
  const { t } = useTranslation("qeetai");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("secret.read");
  const canWrite = canRead && access.can("secret.write");
  const configQuery = useQeetAIProviderConfig(canRead);
  const statusQuery = useQeetAIStatus(canRead);
  const queryClient = useQueryClient();
  const sensitive = useSensitiveAction();
  const activeTenant = useRef(tenantId);

  useEffect(() => {
    activeTenant.current = tenantId;
    return () => {
      activeTenant.current = null;
    };
  }, [tenantId]);

  // A write started for one organisation never lands in another.
  function requireCurrentTenant() {
    if (!tenantId || activeTenant.current !== tenantId) throw new SensitiveActionCancelled();
  }

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qeetaiKeys.providerConfig(tenantId) }),
      queryClient.invalidateQueries({ queryKey: qeetaiKeys.status(tenantId) }),
    ]);

  return (
    <ProviderSettingsView
      key={`${tenantId}:${canWrite}`}
      config={canRead ? configQuery.data : undefined}
      status={canRead ? statusQuery.data : undefined}
      loading={access.state === "resolving" || (canRead && configQuery.isPending)}
      error={canRead && configQuery.isError ? configQuery.error : undefined}
      fetching={canRead && configQuery.isFetching}
      canRead={canRead}
      canWrite={canWrite}
      onRetry={configQuery.refetch}
      onSave={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("form.saveAction"),
          run: () => {
            requireCurrentTenant();
            return setQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        queryClient.setQueryData(qeetaiKeys.providerConfig(tenantId), result);
        await refresh();
        return result;
      }}
      onTest={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("form.testAction"),
          run: () => {
            requireCurrentTenant();
            return testQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        return result;
      }}
      onRemove={() =>
        sensitive({
          capability: "secret.write",
          actionLabel: t("remove.action"),
          confirm: {
            title: t("remove.title"),
            description: t(
              configQuery.data?.platform_fallback ? "remove.fallback" : "remove.unavailable",
            ),
            confirmLabel: t("remove.action"),
            tone: "destructive",
          },
          run: () => {
            requireCurrentTenant();
            return deleteQeetAIProviderConfig();
          },
        })
          .then(async () => {
            await refresh();
            toast.success(t("remove.done"));
          })
          .catch((err: unknown) => {
            if (err instanceof SensitiveActionCancelled) return settleSensitiveAction(err);
            toast.error(errorMessage(err));
            settleSensitiveAction(err);
          })
      }
    />
  );
}

/** The page itself, from what the server said: for the page above and for tests. */
export function ProviderSettingsView(props: ProviderSettingsViewProps) {
  const { t } = useTranslation("qeetai");
  const on = props.status ? (props.status.available ?? props.status.configured) : undefined;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("settings.title")}
        status={
          on === undefined ? undefined : (
            <Badge tone={on ? "success" : "neutral"}>
              {t(on ? "settings.on" : "settings.off")}
            </Badge>
          )
        }
        description={t("settings.description")}
      />
      <PageContent width="narrow">
        <div className="qai-settings">
          {props.loading ? (
            <Section title={t("provider.title")}>
              <div className="account-loading" role="status" aria-label={t("settings.loading")}>
                <Skeleton lines={2} />
              </div>
            </Section>
          ) : !props.canRead ? (
            <EmptyState
              size="section"
              title={t("settings.noAccess")}
              description={t("settings.noAccessText")}
            />
          ) : props.error || !props.config ? (
            <Section title={t("provider.title")}>
              <Alert
                tone="danger"
                title={t("settings.loadFailed")}
                actions={
                  <Button
                    size="sm"
                    variant="soft"
                    icon={RefreshCwIcon}
                    loading={props.fetching}
                    onClick={() => void props.onRetry()}
                  >
                    {t("settings.tryAgain")}
                  </Button>
                }
              >
                {props.error ? errorMessage(props.error) : t("settings.loadFailedText")}
              </Alert>
            </Section>
          ) : (
            <ProviderSection
              config={props.config}
              on={on}
              canWrite={props.canWrite}
              onSave={props.onSave}
              onTest={props.onTest}
              onRemove={props.onRemove}
            />
          )}
          <Section title={t("data.title")}>
            <dl className="account-details">
              <Detail label={t("data.toProvider")}>{t("data.toProviderText")}</Detail>
              <Detail label={t("data.key")}>{t("data.keyText")}</Detail>
              <Detail label={t("data.cost")}>{t("data.costText")}</Detail>
              <Detail label={t("data.audit")}>{t("data.auditText")}</Detail>
            </dl>
          </Section>
        </div>
      </PageContent>
    </>
  );
}
