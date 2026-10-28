import { ArrowLeftRightIcon, EyeIcon, KeyRoundIcon, PlusIcon } from "@qeetrix/icons";
import { Button, Table, type TableSort } from "@qeetrix/react";
import {
  Alert,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  Pagination,
} from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import {
  useAgents,
  useDeleteAgent,
  useKillAllAgents,
  useSetAgentDisabled,
  useUnmanagedClients,
} from "@/modules/developer/api/agents";
import { useRevokeApiKey } from "@/modules/developer/api/api-key-actions";
import { useApiKeys } from "@/modules/developer/api/api-keys";
import { useDisableServicePrincipal } from "@/modules/developer/api/service-principal-actions";
import { useServicePrincipals } from "@/modules/developer/api/service-principals";
import {
  agentRow,
  identityRow,
  keyRow,
  type Machine,
  type MachineFilters,
  type MachineKind,
  matches,
  sortMachines,
} from "@/modules/developer/machine-model";
import { BandPlaceholder, peopleById, personName } from "../parts";
import { AgentDrawer, ChooseKindDrawer, TransferDrawer } from "./agent-drawers";
import { SuspendAll, UnmanagedClients } from "./agent-sections";
import { IdentityDrawer } from "./identity-drawer";
import { KeyDrawer } from "./key-drawer";
import { MachineBand } from "./machine-band";
import { type MachineActions, MachineRowActions, useMachineColumns } from "./machine-table";
import { type MachineTab, TAB_URL } from "./machine-tabs";
import { MachineToolbar } from "./machine-toolbar";
import "../developer.css";

const PAGE_SIZES = [25, 50, 100] as const;
const TAB_KINDS: Record<MachineTab, readonly MachineKind[]> = {
  all: ["key", "identity", "agent"],
  key: ["key"],
  identity: ["identity"],
  agent: ["agent"],
};

export type MachineAccessPageProps = {
  /** Which tab: everything, or one kind. */
  tab: MachineTab;
  /** The filters and search in the page address. */
  filters: MachineFilters;
  /** Puts new filters in the address. */
  onFiltersChange: (next: MachineFilters) => void;
};

/**
 * Developer › Machine access: everything that calls Qeet ID without a person signing in. API keys,
 * machine identities and agents are one list (All) and a tab each, with the same columns, status
 * words, band and actions; each kind adds what only it has (a key's last use and expiry, an agent's
 * sponsor and token lifetime, and on Agents, the unmanaged AI clients and the switch that suspends
 * every agent). Secrets the server returns once show in a drawer only Done closes.
 */
export function MachineAccessPage({ tab, filters, onFiltersChange }: MachineAccessPageProps) {
  const { t } = useTranslation(["developer", "common"]);
  const access = useCapabilities();
  const canWrite = access.can("apikey.write");
  const canReadPeople = access.can("user.read");
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();

  const keysQ = useApiKeys();
  const identitiesQ = useServicePrincipals();
  const agentsQ = useAgents();
  const directory = useQuery({
    ...userQueries.directory(tenantId),
    enabled: canReadPeople && !!tenantId,
  });
  const unmanagedQ = useUnmanagedClients(tab === "agent" && access.can("connection.read"));

  const revokeM = useRevokeApiKey();
  const disableM = useDisableServicePrincipal();
  const suspendM = useSetAgentDisabled();
  const deleteM = useDeleteAgent();
  const killAllM = useKillAllAgents();

  const [creating, setCreating] = useCreateIntent(canWrite);
  const [drawer, setDrawer] = useState<MachineKind | "choose" | "transfer" | null>(null);
  const [replacing, setReplacing] = useState<Machine | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);

  const now =
    Math.max(keysQ.dataUpdatedAt, identitiesQ.dataUpdatedAt, agentsQ.dataUpdatedAt) || Date.now();
  const people = useMemo(() => peopleById(directory.data?.items), [directory.data]);
  // Sponsors who can no longer answer for an agent: suspended, or no longer in the directory.
  const gone = useMemo(() => {
    const out = new Set<string>();
    if (!directory.data) return out;
    for (const a of agentsQ.data?.items ?? []) {
      const id = a.sponsor_user_id;
      if (!id) continue;
      const person = people.get(id);
      if (person?.status !== "active") out.add(id);
    }
    return out;
  }, [agentsQ.data, directory.data, people]);

  const byKind = useMemo(
    () => ({
      key: (keysQ.data?.items ?? []).map((k) => keyRow(k, now)),
      identity: (identitiesQ.data?.items ?? []).map(identityRow),
      agent: (agentsQ.data?.items ?? []).filter((a) => a.status !== "decommissioned").map(agentRow),
    }),
    [keysQ.data, identitiesQ.data, agentsQ.data, now],
  );
  const queries = { key: keysQ, identity: identitiesQ, agent: agentsQ };
  const kinds = TAB_KINDS[tab];
  const rows = useMemo(() => kinds.flatMap((k) => byKind[k]), [kinds, byKind]);
  const failed = kinds.map((k) => queries[k]).find((q) => q.isError);
  const loading = kinds.some((k) => queries[k].isLoading);

  const nameOf = (id: string) => personName(people.get(id));
  const visible = useMemo(() => {
    const name = (id: string) => personName(people.get(id));
    return sortMachines(
      rows.filter((m) => matches(m, filters, now, gone, name)),
      sort,
    );
  }, [rows, filters, now, gone, sort, people]);
  const start = offset < visible.length ? offset : 0;
  const onPage = visible.slice(start, start + pageSize);
  const columns = useMachineColumns(tab, now, people);
  const change = (next: MachineFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };
  const filtered = Object.values(filters).some(Boolean);

  // ── Actions: each through the console's one confirm (what happens, from the server) and step-up.
  const settle = (p: Promise<unknown>) => void p.catch(settleSensitiveAction);
  const actions: MachineActions = {
    replace: (m) => {
      setReplacing(m);
      setDrawer("key");
    },
    revoke: (m) =>
      settle(
        runSensitive({
          confirm: {
            title: t("machine.confirm.revokeTitle", { name: m.name }),
            description: m.personId
              ? t("machine.confirm.revokePersonal", {
                  name: nameOf(m.personId) ?? t("owner.unknown"),
                })
              : t("machine.confirm.revoke"),
            confirmLabel: t("machine.confirm.revokeLabel"),
            tone: "destructive",
          },
          capability: "apikey.write",
          actionLabel: t("machine.confirm.revokeAction"),
          run: () => revokeM.mutateAsync(m.id),
        }),
      ),
    disable: (m) =>
      settle(
        runSensitive({
          confirm: {
            title: t("machine.confirm.disableTitle", { name: m.name }),
            description: t("machine.confirm.disable"),
            confirmLabel: t("machine.confirm.disableLabel"),
            tone: "destructive",
          },
          capability: "apikey.write",
          actionLabel: t("machine.confirm.disableAction"),
          run: () => disableM.mutateAsync(m.id),
        }),
      ),
    suspend: (m) =>
      settle(
        runSensitive({
          confirm: {
            title: t("machine.confirm.suspendTitle", { name: m.name }),
            description: t("machine.confirm.suspend", {
              name: (m.personId && nameOf(m.personId)) || t("owner.itsSponsor"),
            }),
            confirmLabel: t("machine.confirm.suspendLabel"),
            tone: "default",
          },
          capability: "apikey.write",
          actionLabel: t("machine.confirm.suspendAction"),
          run: () => suspendM.mutateAsync({ id: m.id, disabled: true }),
        }),
      ),
    resume: (m) =>
      settle(
        runSensitive({
          capability: "apikey.write",
          actionLabel: t("machine.confirm.resumeAction", { name: m.name }),
          run: () => suspendM.mutateAsync({ id: m.id, disabled: false }),
        }),
      ),
    remove: (m) =>
      settle(
        runSensitive({
          confirm: {
            title: t("machine.confirm.deleteTitle", { name: m.name }),
            description: t("machine.confirm.delete"),
            confirmLabel: t("machine.confirm.deleteLabel"),
            tone: "destructive",
          },
          capability: "apikey.write",
          actionLabel: t("machine.confirm.deleteAction"),
          run: () => deleteM.mutateAsync(m.id),
        }),
      ),
  };
  const activeAgents = byKind.agent.filter((m) => m.status === "active").length;
  const suspendAll = () =>
    settle(
      runSensitive({
        confirm: {
          title: t("suspendAll.confirmTitle", { count: activeAgents }),
          description: t("suspendAll.confirm"),
          confirmLabel: t("suspendAll.button"),
          tone: "destructive",
        },
        capability: "apikey.write",
        actionLabel: t("suspendAll.button"),
        run: () => killAllM.mutateAsync(),
      }),
    );

  const create = () => {
    if (tab === "all") setDrawer("choose");
    else {
      setReplacing(null);
      setDrawer(tab);
    }
  };
  const createOpen = (kind: MachineKind) => drawer === kind || (creating && tab === kind);
  const closeCreate = () => {
    setCreating(false);
    setDrawer(null);
  };
  const newLabel = t(`machine.new.${tab}`);
  const sponsorIds = [
    ...new Set(byKind.agent.map((m) => m.personId).filter((id): id is string => !!id)),
  ];

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t(`machine.title.${tab}`)}
        count={loading ? undefined : rows.length}
        description={
          <Trans
            t={t}
            i18nKey={`machine.description.${tab}`}
            components={{ code: <code className="dev-code" /> }}
          />
        }
        actions={
          canWrite ? (
            <>
              {tab === "agent" && sponsorIds.length ? (
                <Button
                  variant="ghost"
                  icon={ArrowLeftRightIcon}
                  onClick={() => setDrawer("transfer")}
                >
                  {t("transfer.title")}
                </Button>
              ) : null}
              <Button icon={PlusIcon} onClick={create}>
                {newLabel}
              </Button>
            </>
          ) : undefined
        }
        summary={
          failed ? undefined : loading || (canReadPeople && directory.isLoading) ? (
            <BandPlaceholder cells={4} />
          ) : (
            <MachineBand
              tab={tab}
              rows={rows}
              now={now}
              gone={gone}
              people={people}
              unmanaged={unmanagedQ.data?.items.length}
            />
          )
        }
        tabs={
          <PageTabList
            badges={{
              [TAB_URL.all]: byKind.key.length + byKind.identity.length + byKind.agent.length,
              [TAB_URL.key]: byKind.key.length,
              [TAB_URL.identity]: byKind.identity.length,
              [TAB_URL.agent]: byKind.agent.length,
            }}
          />
        }
      />
      <PageContent>
        <div className="ppl dev-page">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {failed ? (
            <DataState error={failed.error} onRetry={() => void failed.refetch()} />
          ) : (
            <>
              <Table<Machine>
                label={t(`machine.title.${tab}`)}
                rows={onPage}
                rowId={(m) => `${m.kind}:${m.id}`}
                rowLabel={(m) => m.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={loading}
                toolbar={
                  rows.length ? (
                    <MachineToolbar
                      tab={tab}
                      rows={rows}
                      now={now}
                      people={people}
                      filters={filters}
                      onFiltersChange={change}
                      shown={visible.length}
                    />
                  ) : undefined
                }
                rowActions={
                  canWrite ? (m) => <MachineRowActions machine={m} actions={actions} /> : undefined
                }
                empty={
                  filtered && rows.length ? (
                    <EmptyState
                      size="section"
                      icon={KeyRoundIcon}
                      title={t("machine.empty.filteredTitle")}
                      description={t("machine.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("machine.empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={KeyRoundIcon}
                      title={t(`machine.empty.title.${tab}`)}
                      description={t(`machine.empty.description.${tab}`)}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={create}>
                            {newLabel}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {visible.length > PAGE_SIZES[0] ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={visible.length}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setOffset(0);
                  }}
                />
              ) : null}
            </>
          )}

          {tab === "agent" && !failed && !loading ? (
            <div className="dev-sections">
              {access.can("connection.read") && unmanagedQ.data ? (
                <UnmanagedClients
                  clients={unmanagedQ.data.items}
                  now={now}
                  canReview={access.can("connection.write")}
                />
              ) : null}
              {canWrite ? (
                <SuspendAll
                  active={activeAgents}
                  pending={killAllM.isPending}
                  onSuspendAll={suspendAll}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <ChooseKindDrawer
            open={drawer === "choose" || (creating && tab === "all")}
            onOpenChange={(open) => !open && closeCreate()}
            can={() => true}
            onChoose={(kind) => {
              setCreating(false);
              setReplacing(null);
              setDrawer(kind);
            }}
          />
          <KeyDrawer
            open={createOpen("key")}
            onOpenChange={(open) => {
              if (open) return;
              closeCreate();
              setReplacing(null);
            }}
            replacing={replacing}
          />
          <IdentityDrawer
            open={createOpen("identity")}
            onOpenChange={(open) => !open && closeCreate()}
          />
          <AgentDrawer
            open={createOpen("agent")}
            onOpenChange={(open) => !open && closeCreate()}
            people={directory.data?.items ?? []}
          />
          <TransferDrawer
            open={drawer === "transfer"}
            onOpenChange={(open) => !open && setDrawer(null)}
            people={people}
            sponsorIds={sponsorIds}
          />
        </>
      ) : null}
    </PageTabs>
  );
}
