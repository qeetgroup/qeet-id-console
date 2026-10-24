import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  Field,
  FieldLabel,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { useQuery } from "@tanstack/react-query";
import { ErrorText } from "@/platform/components/error-reference";
import {
  ArrowRightLeftIcon,
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  ShieldAlertIcon,
  SkullIcon,
  SparklesIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type Agent,
  useAgents,
  useAgentsSponsoredBy,
  useCreateAgent,
  useDeleteAgent,
  useKillAllAgents,
  useSetAgentDisabled,
  useTransferSponsor,
} from "../api/agents";
import { useMe, useTenantId } from "@/platform/auth/session";
import { useReviewShadowAIClient, useShadowAICandidates } from "@/modules/authentication";
import { userQueries } from "@/modules/users";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { useMemo } from "react";
import { z } from "zod";

/** Renders agent governance: create, the agent list, kill switch, sponsor transfer and shadow AI. */
export function AgentsPage() {
  const { t } = useTranslation(["developer", "common"]);
  const runSensitive = useSensitiveAction();
  const meQ = useMe();
  const agentsQ = useAgents();
  const deleteM = useDeleteAgent();
  const disableM = useSetAgentDisabled();
  const killAllM = useKillAllAgents();

  const [created, setCreated] = useState<Agent | null>(null);

  const items = agentsQ.data?.items ?? [];
  const activeCount = items.filter((a) => !a.disabled).length;
  const sponsorId = meQ.data?.id;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={t("agentsPage.agentGovernance")} description={t("agents.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("agents.create.title")}</CardTitle>
          <CardDescription>{t("agents.create.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAgentForm sponsorId={sponsorId} onCreated={setCreated} />

          {created?.secret && (
            <div className="mt-4">
              <OneTimeSecret
                title={t("agents.create.secretTitle")}
                description={t("agents.create.secretNotice", { name: created.name })}
                values={[
                  { label: "agent_id=", value: created.id },
                  { label: "secret=", value: created.secret },
                ]}
                dismissLabel={t("common:actions.dismiss")}
                onDismiss={() => setCreated(null)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t("agents.list.title")}</CardTitle>
            <CardDescription>{t("agents.list.description")}</CardDescription>
          </div>
          {activeCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={killAllM.isPending}
              onClick={() =>
                runSensitive({
                  confirm: {
                    title: t("agents.confirm.suspendAll", { count: activeCount }),
                    description: t("agents.confirm.suspendAllDescription"),
                    confirmLabel: t("agents.confirm.suspendAllLabel"),
                    tone: "destructive",
                  },
                  actionLabel: t("agents.stepUp.suspendAll"),
                  run: () => killAllM.mutateAsync(),
                }).catch(settleSensitiveAction)
              }
            >
              {killAllM.isPending ? <LoaderCircleIcon className="animate-spin" /> : <SkullIcon />}
              {t("agents.list.suspendAll")}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={agentsQ.isLoading}
            isError={agentsQ.isError}
            error={agentsQ.error}
            isEmpty={items.length === 0}
            emptyIcon={SparklesIcon}
            emptyTitle={t("agents.list.empty")}
            emptyDescription={t("agents.list.emptyDescription")}
            skeletonRows={2}
          >
            <ul className="divide-y">
              {items.map((a) => (
                <AgentRow
                  key={a.id}
                  agent={a}
                  onToggle={() =>
                    runSensitive({
                      actionLabel: a.disabled
                        ? t("agents.stepUp.resume")
                        : t("agents.stepUp.suspend"),
                      run: () => disableM.mutateAsync({ id: a.id, disabled: !a.disabled }),
                    }).catch(settleSensitiveAction)
                  }
                  onDelete={() =>
                    runSensitive({
                      confirm: {
                        title: t("agents.confirm.delete", { name: a.name }),
                        confirmLabel: t("agents.confirm.deleteLabel"),
                        tone: "destructive",
                      },
                      actionLabel: t("agents.stepUp.delete"),
                      run: () => deleteM.mutateAsync(a.id),
                    }).catch(settleSensitiveAction)
                  }
                  busy={disableM.isPending || deleteM.isPending}
                />
              ))}
            </ul>
          </DataState>
        </CardContent>
      </Card>

      <SponsorTransferCard />
      <ShadowAICard />
    </div>
  );
}

// The sponsor pickers list the tenant's first page of users.
const SPONSOR_PICKER_PAGE = { limit: 200, offset: 0 };

function useTenantUserOptions() {
  const tenantId = useTenantId();
  return useQuery({
    ...userQueries.list(tenantId, SPONSOR_PICKER_PAGE),
    select: (data) =>
      data.items.map((u) => ({
        label: u.display_name ? `${u.display_name} · ${u.email}` : u.email,
        value: u.id,
      })),
  });
}

function SponsorTransferCard() {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const usersQ = useTenantUserOptions();
  const [fromUserId, setFromUserId] = useState<string | null>(null);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const sponsoredQ = useAgentsSponsoredBy(fromUserId);
  const transferM = useTransferSponsor();

  const sponsoredCount = sponsoredQ.data?.items.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agents.sponsor.title")}</CardTitle>
        <CardDescription>{t("agents.sponsor.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel htmlFor="sponsor-from">{t("agents.sponsor.from")}</FieldLabel>
            <Combobox
              id="sponsor-from"
              items={usersQ.data ?? []}
              value={fromUserId}
              onValueChange={setFromUserId}
              placeholder={t("agents.sponsor.search")}
              emptyMessage={t("agents.sponsor.noUsers")}
            />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="sponsor-to">{t("agents.sponsor.to")}</FieldLabel>
            <Combobox
              id="sponsor-to"
              items={usersQ.data ?? []}
              value={toUserId}
              onValueChange={setToUserId}
              placeholder={t("agents.sponsor.search")}
              emptyMessage={t("agents.sponsor.noUsers")}
            />
          </Field>
          <Button
            disabled={
              !fromUserId ||
              !toUserId ||
              fromUserId === toUserId ||
              sponsoredCount === 0 ||
              transferM.isPending
            }
            onClick={() => {
              if (!fromUserId || !toUserId) return;
              runSensitive({
                confirm: {
                  title: t("agents.sponsor.confirm.title", { count: sponsoredCount }),
                  description: t("agents.sponsor.confirm.description"),
                  confirmLabel: t("agents.sponsor.confirm.label"),
                  tone: "destructive",
                },
                actionLabel: t("agents.sponsor.stepUp"),
                run: () => transferM.mutateAsync({ fromUserId, toUserId }),
              })
                .then(() => {
                  setFromUserId(null);
                  setToUserId(null);
                })
                .catch(settleSensitiveAction);
            }}
          >
            {transferM.isPending && <LoaderCircleIcon className="animate-spin" />}
            <ArrowRightLeftIcon />
            {t("agents.sponsor.transfer")}
          </Button>
        </div>
        {fromUserId && (
          <p className="mt-2 text-sm text-muted-foreground">
            {sponsoredQ.isLoading
              ? t("agents.sponsor.checking")
              : t("agents.sponsor.count", { count: sponsoredCount })}
          </p>
        )}
        {transferM.error && (
          <p className="mt-2 text-destructive text-sm">
            <ErrorText error={transferM.error} />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ShadowAICard() {
  const { t } = useTranslation("developer");
  const candidatesQ = useShadowAICandidates();
  const reviewM = useReviewShadowAIClient();
  const items = candidatesQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agents.shadow.title")}</CardTitle>
        <CardDescription>{t("agents.shadow.description")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <DataState
          isLoading={candidatesQ.isLoading}
          isError={candidatesQ.isError}
          error={candidatesQ.error}
          isEmpty={items.length === 0}
          emptyIcon={ShieldAlertIcon}
          emptyTitle={t("agents.shadow.empty")}
          emptyDescription={t("agents.shadow.emptyDescription")}
          skeletonRows={2}
        >
          <ul className="divide-y">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{c.client_id}</span> · {c.grant_types.join(", ")} ·{" "}
                    {t("agents.shadow.grants", { count: c.live_grants })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={reviewM.isPending}
                  onClick={() => reviewM.mutate(c.id)}
                >
                  {t("agents.shadow.acknowledge")}
                </Button>
              </li>
            ))}
          </ul>
        </DataState>
      </CardContent>
    </Card>
  );
}

function AgentRow({
  agent: a,
  onToggle,
  onDelete,
  busy,
}: {
  agent: Agent;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("developer");
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {a.name}
          {a.disabled ? (
            <Badge variant="outline" className="text-amber-600 border-amber-400">
              {t("agents.row.suspended")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-400">
              {t("agents.row.active")}
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{a.id}</span> · {a.token_ttl_seconds}s ·{" "}
          {a.scopes.length ? a.scopes.join(" ") : t("agents.row.noScopes")}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onToggle}
          title={a.disabled ? t("agents.row.resumeTitle") : t("agents.row.suspendTitle")}
        >
          {a.disabled ? <PlayIcon /> : <PauseIcon />}
          {a.disabled ? t("agents.row.resume") : t("agents.row.suspend")}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDelete}>
          <TrashIcon /> {t("agents.row.delete")}
        </Button>
      </div>
    </li>
  );
}

/** Renders the inline form that creates an agent sponsored by the signed-in person. */
function CreateAgentForm({
  sponsorId,
  onCreated,
}: {
  sponsorId: string | undefined;
  onCreated: (agent: Agent) => void;
}) {
  const { t } = useTranslation("developer");
  const runSensitive = useSensitiveAction();
  const createM = useCreateAgent();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("agents.create.validation.name")),
        scopes: z.string(),
        token_ttl_seconds: z
          .number(t("agents.create.validation.ttl"))
          .int(t("agents.create.validation.ttl"))
          .min(60, t("agents.create.validation.ttl"))
          .max(3600, t("agents.create.validation.ttl")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", scopes: "", token_ttl_seconds: 600 as number | null },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!sponsorId) return;
      const scopes = value.scopes.trim();
      await runSensitive({
        actionLabel: t("agents.stepUp.create"),
        run: () =>
          createM.mutateAsync({
            name: value.name.trim(),
            scopes: scopes ? scopes.split(/\s+/) : [],
            token_ttl_seconds: value.token_ttl_seconds ?? 600,
            sponsor_user_id: sponsorId,
          }),
      })
        .then((agent) => {
          if (!agent) return;
          onCreated(agent);
          formApi.reset();
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                label={t("agents.create.name")}
                placeholder={t("agents.create.namePlaceholder")}
                required
              />
            )}
          </form.AppField>
        </div>
        <div className="flex-1">
          <form.AppField name="scopes">
            {(field) => (
              <field.TextField
                label={t("agents.create.scopes")}
                placeholder={t("agents.create.scopesPlaceholder")}
              />
            )}
          </form.AppField>
        </div>
        <div className="sm:w-32">
          <form.AppField name="token_ttl_seconds">
            {(field) => <field.NumberField label={t("agents.create.ttl")} min={60} max={3600} />}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton disabled={!sponsorId}>{t("agents.create.submit")}</form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={createM.error} />
    </form>
  );
}
