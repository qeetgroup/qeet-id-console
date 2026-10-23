import { Button, cn, Skeleton } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { BoxIcon, RefreshCwIcon, ShieldCheckIcon, WandSparklesIcon } from "@qeetrix/icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  deleteQeetAIProviderConfig,
  type QeetAIProviderConfig,
  setQeetAIProviderConfig,
  testQeetAIProviderConfig,
  useQeetAIProviderConfig,
} from "../api/qeetai";
import { qeetaiKeys } from "../api/keys";
import { ProviderSettingsGuidance } from "./provider-settings-guidance";
import {
  PANEL,
  type ProviderSettingsActions,
  ProviderSettingsForm,
} from "./provider-settings-page-form";

export type ProviderSettingsViewProps = ProviderSettingsActions & {
  config?: QeetAIProviderConfig;
  loading: boolean;
  error: boolean;
  fetching: boolean;
  canRead: boolean;
  canWrite: boolean;
  onRetry: () => unknown;
};

export function QeetAISettingsPage() {
  const { t } = useTranslation("qeetai");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("secret.read");
  const canWrite = canRead && access.can("secret.write");
  const configQuery = useQeetAIProviderConfig(canRead);
  const queryClient = useQueryClient();
  const sensitive = useSensitiveAction();
  const queryKey = qeetaiKeys.providerConfig(tenantId);
  const activeTenant = useRef(tenantId);

  useEffect(() => {
    activeTenant.current = tenantId;
    return () => {
      activeTenant.current = null;
    };
  }, [tenantId]);

  function requireCurrentTenant() {
    if (!tenantId || activeTenant.current !== tenantId) throw new SensitiveActionCancelled();
  }

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qeetaiKeys.providerConfig(tenantId) }),
      queryClient.invalidateQueries({ queryKey: qeetaiKeys.status() }),
    ]);
  };

  return (
    <ProviderSettingsView
      key={`${tenantId}:${canWrite}`}
      config={canRead ? configQuery.data : undefined}
      loading={access.state === "resolving" || (canRead && configQuery.isPending)}
      error={canRead && configQuery.isError}
      fetching={canRead && configQuery.isFetching}
      canRead={canRead}
      canWrite={canWrite}
      onRetry={configQuery.refetch}
      onSave={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.save"),
          run: () => {
            requireCurrentTenant();
            return setQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        queryClient.setQueryData(queryKey, result);
        await refresh();
        return result;
      }}
      onTest={async (input) => {
        const result = await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.test"),
          run: () => {
            requireCurrentTenant();
            return testQeetAIProviderConfig(input);
          },
        });
        if (!result) throw new SensitiveActionCancelled();
        return result;
      }}
      onRemove={async () => {
        await sensitive({
          capability: "secret.write",
          actionLabel: t("qeetAI.actions.remove"),
          confirm: {
            title: t("qeetAI.remove.title"),
            description: t(
              configQuery.data?.platform_fallback
                ? "qeetAI.remove.fallback"
                : "qeetAI.remove.unavailable",
            ),
            confirmLabel: t("qeetAI.actions.remove"),
            tone: "destructive",
          },
          run: () => {
            requireCurrentTenant();
            return deleteQeetAIProviderConfig();
          },
        });
        await refresh();
        return queryClient.getQueryData<QeetAIProviderConfig>(queryKey);
      }}
    />
  );
}

export function ProviderSettingsView(props: ProviderSettingsViewProps) {
  const { t } = useTranslation("qeetai");
  const configuration = !props.error && props.canRead ? props.config : undefined;

  return (
    <div className="@container/ai-settings relative isolate flex min-w-0 flex-col gap-4 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="relative flex min-h-20 items-start justify-between gap-4 py-1">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <WandSparklesIcon className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-[30px] leading-9 font-semibold">
              {t("qeetAI.title")}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
              {t("qeetAI.description")}
            </p>
          </div>
        </div>
        <div className="pointer-events-none hidden shrink-0 items-center gap-5 text-primary @min-[980px]/ai-settings:flex">
          <BoxIcon className="size-19 text-primary/20" strokeWidth={0.6} aria-hidden="true" />
          <p className="pe-4 text-xs leading-5">
            {t("qeetAI.tagline.data")}
            <br />
            {t("qeetAI.tagline.ai")}
            <br />
            {t("qeetAI.tagline.control")}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-4 @min-[820px]/ai-settings:grid-cols-[minmax(0,1.95fr)_minmax(17rem,1fr)]">
        {props.loading ? (
          <section
            role="status"
            aria-label={t("qeetAI.loading")}
            className={cn(PANEL, "space-y-6 p-5")}
          >
            <Skeleton className="h-10 w-3/4" />
            {["provider", "key", "url", "tokens"].map((field) => (
              <Skeleton key={field} className="h-16 w-full" />
            ))}
            <Skeleton className="h-9 w-full" />
          </section>
        ) : !props.canRead || props.error || !configuration ? (
          <section
            className={cn(
              PANEL,
              "grid min-h-80 place-content-center justify-items-center gap-3 p-6 text-center",
            )}
          >
            <ShieldCheckIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-heading text-base font-semibold">
              {t(props.canRead ? "qeetAI.loadError" : "qeetAI.noAccess")}
            </h2>
            {props.canRead ? (
              <Button
                variant="outline"
                size="sm"
                disabled={props.fetching}
                onClick={() => void props.onRetry()}
              >
                <RefreshCwIcon />
                {t("qeetAI.retry")}
              </Button>
            ) : null}
          </section>
        ) : (
          <ProviderSettingsForm
            config={configuration}
            canWrite={props.canWrite}
            onSave={props.onSave}
            onTest={props.onTest}
            onRemove={props.onRemove}
          />
        )}
        <ProviderSettingsGuidance fallback={configuration?.platform_fallback} />
      </div>
    </div>
  );
}
