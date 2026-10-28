import {
  EyeIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  ShieldIcon,
  ShieldOffIcon,
  TrashIcon,
  ZapIcon,
} from "@qeetrix/icons";
import { Badge, Button, MenuItem, MenuSeparator, Table } from "@qeetrix/react";
import {
  Alert,
  CodeBlock,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
} from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import {
  type AuthHook,
  useAuthHooks,
  useDeleteAuthHook,
  useUpdateAuthHook,
} from "@/modules/developer/api/auth-hooks";
import { endpointParts } from "@/modules/developer/webhook-state";
import { BandCount, BandPlaceholder, BandSplit, DevSection, useNumbers, When } from "../parts";
import { Endpoint } from "../webhooks/webhook-parts";
import { AddHookDrawer, HOOK_SECONDS } from "./auth-hook-drawer";
import "../developer.css";

/**
 * Developer › Auth hooks: endpoints that allow or deny each sign-in. On every sign-in, whatever the
 * method, once the first factor is proven, the server calls each hook that's on, oldest first, and
 * the first "deny" stops it. Each waits 3 seconds at most; what happens when one can't answer is
 * the setting that can lock people out, so the list leads with it.
 */
export function AuthHooksPage() {
  const { t } = useTranslation(["developer", "common"]);
  const { n } = useNumbers();
  const access = useCapabilities();
  const canWrite = access.can("policy.write");
  const runSensitive = useSensitiveAction();
  const hooksQ = useAuthHooks();
  const updateM = useUpdateAuthHook();
  const deleteM = useDeleteAuthHook();
  const [adding, setAdding] = useCreateIntent(canWrite);
  const all = hooksQ.data?.items ?? [];
  const now = hooksQ.dataUpdatedAt || Date.now();
  const on = all.filter((h) => h.enabled);
  const settle = (p: Promise<unknown>) => void p.catch(settleSensitiveAction);
  const host = (h: AuthHook) => endpointParts(h.url).host;
  // The server's PATCH takes both settings and reads a missing one as false: always send both.
  const update = (
    h: AuthHook,
    patch: Partial<Pick<AuthHook, "enabled" | "fail_open">>,
    label: string,
  ) =>
    runSensitive({
      capability: "policy.write",
      actionLabel: label,
      run: () =>
        updateM.mutateAsync({ id: h.id, enabled: h.enabled, fail_open: h.fail_open, ...patch }),
    });

  const turnOff = (h: AuthHook) =>
    settle(
      runSensitive({
        confirm: {
          title: t("authHooks.confirm.offTitle", { host: host(h) }),
          description: t("authHooks.confirm.off"),
          confirmLabel: t("authHooks.confirm.offLabel"),
          tone: "default",
        },
        capability: "policy.write",
        actionLabel: t("authHooks.confirm.offAction"),
        run: () => updateM.mutateAsync({ id: h.id, enabled: false, fail_open: h.fail_open }),
      }),
    );
  const block = (h: AuthHook) =>
    settle(
      runSensitive({
        confirm: {
          title: t("authHooks.confirm.blockTitle", { host: host(h) }),
          description: t("authHooks.confirm.block"),
          confirmLabel: t("authHooks.confirm.blockLabel"),
          tone: "destructive",
        },
        capability: "policy.write",
        actionLabel: t("authHooks.confirm.blockAction"),
        run: () => updateM.mutateAsync({ id: h.id, enabled: h.enabled, fail_open: false }),
      }),
    );
  const remove = (h: AuthHook) =>
    settle(
      runSensitive({
        confirm: {
          title: t("authHooks.confirm.removeTitle", { host: host(h) }),
          description: t("authHooks.confirm.remove"),
          confirmLabel: t("authHooks.confirm.removeLabel"),
          tone: "destructive",
        },
        capability: "policy.write",
        actionLabel: t("authHooks.confirm.removeAction"),
        run: () => deleteM.mutateAsync(h.id),
      }),
    );

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("authHooks.title")}
        count={hooksQ.data ? all.length : undefined}
        description={t("authHooks.description", { seconds: HOOK_SECONDS })}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => setAdding(true)}>
              {t("authHooks.add")}
            </Button>
          ) : undefined
        }
        summary={
          hooksQ.isError ? undefined : !hooksQ.data ? (
            <BandPlaceholder cells={3} />
          ) : (
            <dl className="ppl-band is-three">
              <BandCount
                label={t("authHooks.band.on")}
                value={n(on.length)}
                note={t("authHooks.band.onNote", { total: n(all.length) })}
              />
              <BandSplit
                label={t("authHooks.band.cantAnswer")}
                parts={[
                  {
                    id: "allow",
                    count: all.filter((h) => h.fail_open).length,
                    label: t("authHooks.band.allows"),
                    color: "var(--qx-color-dataviz-positive)",
                  },
                  {
                    id: "block",
                    count: all.filter((h) => !h.fail_open).length,
                    label: t("authHooks.band.blocks"),
                    color: "var(--qx-color-dataviz-warning)",
                  },
                ]}
              />
              <BandCount
                label={t("authHooks.band.wait")}
                value={t("authHooks.band.seconds", { n: n(on.length * HOOK_SECONDS) })}
                note={t("authHooks.band.waitNote", { seconds: HOOK_SECONDS })}
              />
            </dl>
          )
        }
      />
      <PageContent>
        <div className="ppl dev-page">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {hooksQ.isError ? (
            <DataState error={hooksQ.error} onRetry={() => void hooksQ.refetch()} />
          ) : (
            <Table<AuthHook>
              label={t("authHooks.title")}
              rows={all}
              rowId={(h) => h.id}
              rowLabel={(h) => h.url}
              loading={hooksQ.isLoading}
              columns={[
                {
                  id: "url",
                  header: t("authHooks.columns.endpoint"),
                  primary: true,
                  cell: (h) => <Endpoint url={h.url} />,
                },
                {
                  id: "fail",
                  header: t("authHooks.columns.cantAnswer"),
                  cell: (h) => (
                    <span className="dev-two">
                      <span>
                        {h.fail_open ? (
                          t("authHooks.row.allows")
                        ) : (
                          <Badge tone="warning" size="sm">
                            {t("authHooks.row.blocks")}
                          </Badge>
                        )}
                      </span>
                      <small>
                        {h.fail_open
                          ? t("authHooks.row.allowsLine")
                          : t("authHooks.row.blocksLine")}
                      </small>
                    </span>
                  ),
                },
                {
                  id: "status",
                  header: t("authHooks.columns.status"),
                  width: 110,
                  cell: (h) => (
                    <Badge tone={h.enabled ? "success" : "neutral"} size="sm">
                      {h.enabled ? t("authHooks.row.on") : t("authHooks.row.off")}
                    </Badge>
                  ),
                },
                {
                  id: "added",
                  header: t("authHooks.columns.added"),
                  numeric: true,
                  width: 140,
                  cell: (h) => <When at={h.created_at} now={now} />,
                },
              ]}
              rowActions={
                canWrite
                  ? (h) => (
                      <>
                        {h.enabled ? (
                          <MenuItem icon={PowerOffIcon} onClick={() => turnOff(h)}>
                            {t("authHooks.actions.off")}
                          </MenuItem>
                        ) : (
                          <MenuItem
                            icon={PowerIcon}
                            onClick={() =>
                              settle(update(h, { enabled: true }, t("authHooks.actions.onAction")))
                            }
                          >
                            {t("authHooks.actions.on")}
                          </MenuItem>
                        )}
                        {h.fail_open ? (
                          <MenuItem
                            icon={ShieldIcon}
                            description={t("authHooks.actions.blockHint")}
                            onClick={() => block(h)}
                          >
                            {t("authHooks.actions.block")}
                          </MenuItem>
                        ) : (
                          <MenuItem
                            icon={ShieldOffIcon}
                            description={t("authHooks.actions.allowHint")}
                            onClick={() =>
                              settle(
                                update(h, { fail_open: true }, t("authHooks.actions.allowAction")),
                              )
                            }
                          >
                            {t("authHooks.actions.allow")}
                          </MenuItem>
                        )}
                        <MenuSeparator />
                        <MenuItem icon={TrashIcon} tone="danger" onClick={() => remove(h)}>
                          {t("authHooks.actions.remove")}
                        </MenuItem>
                      </>
                    )
                  : undefined
              }
              empty={
                <EmptyState
                  size="section"
                  icon={ZapIcon}
                  title={t("authHooks.empty.title")}
                  description={t("authHooks.empty.description")}
                  actions={
                    canWrite ? (
                      <Button icon={PlusIcon} onClick={() => setAdding(true)}>
                        {t("authHooks.add")}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}

          <div className="dev-sections">
            <DevSection
              id="hook-call"
              title={t("authHooks.call.title")}
              note={t("authHooks.call.note")}
            >
              <div className="dev-pair">
                <CodeBlock
                  language="json"
                  title={t("authHooks.call.request")}
                  code={JSON.stringify(
                    {
                      trigger: "post_login",
                      tenant_id: "…",
                      user_id: "…",
                      email: "priya@example.com",
                      timestamp: "2026-10-28T09:30:00Z",
                    },
                    null,
                    2,
                  )}
                />
                <CodeBlock
                  language="json"
                  title={t("authHooks.call.answer")}
                  code={JSON.stringify(
                    { decision: "allow", claims: { department: "Finance" } },
                    null,
                    2,
                  )}
                />
              </div>
              <ul className="dev-rules">
                <li>{t("authHooks.call.signature")}</li>
                <li>{t("authHooks.call.deny")}</li>
                <li>{t("authHooks.call.claims")}</li>
              </ul>
            </DevSection>
          </div>
        </div>
      </PageContent>
      {canWrite ? <AddHookDrawer open={adding} onOpenChange={setAdding} /> : null}
    </>
  );
}
