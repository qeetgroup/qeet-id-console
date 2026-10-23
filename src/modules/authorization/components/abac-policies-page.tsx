import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SegmentedControl,
  SegmentedControlItem,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import {
  LoaderCircleIcon,
  PlayIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FieldFrame, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { CodePreview } from "./code-preview/code-preview";
import { ConditionTree } from "./condition-builder/condition-tree";
import { DecisionExplain } from "./explain/decision-explain";
import { MonacoPanel } from "./shared/monaco-panel";
import { FeatureGate, useEntitlements } from "@/modules/billing";
import {
  type AbacPolicy,
  type CondNode,
  conditionProblem,
  type Effect,
  emptyGroup,
  fromConditionJson,
  toConditionJson,
  useAbacPolicies,
  useCreateAbacPolicy,
  useDeleteAbacPolicy,
  useUpdateAbacPolicy,
} from "../api/abac";
import type { PolicyDoc } from "../utils/policy-codegen";
import { type DecisionRecord, useAbacSimulate } from "../api/simulate";
import { pushDecision } from "../store/authz-store";

interface Draft {
  id?: string;
  name: string;
  description: string;
  effect: Effect;
  resourceType: string;
  action: string;
  priority: number;
  enabled: boolean;
  condition: CondNode;
}

function newDraft(): Draft {
  return {
    name: "",
    description: "",
    effect: "allow",
    resourceType: "",
    action: "",
    priority: 10,
    enabled: true,
    condition: emptyGroup("all"),
  };
}

function draftFromPolicy(p: AbacPolicy): Draft {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    effect: p.effect,
    resourceType: p.resource_type,
    action: p.action,
    priority: p.priority,
    enabled: p.enabled,
    condition: fromConditionJson(p.condition),
  };
}

function draftToDoc(d: Draft): PolicyDoc {
  return {
    name: d.name,
    description: d.description,
    effect: d.effect,
    resourceType: d.resourceType,
    action: d.action,
    requireRole: null,
    condition: d.condition,
    relation: null,
    priority: d.priority,
    enabled: d.enabled,
  };
}

/** Renders the ABAC policies: list, edit with the condition builder, and a dry run. */
export function AbacPoliciesPage() {
  const { t } = useTranslation("rbac");
  const policiesQ = useAbacPolicies();
  const [draft, setDraft] = useState<Draft | null>(null);
  const policies = policiesQ.data?.items ?? [];
  const deleteM = useDeleteAbacPolicy();
  const runSensitive = useSensitiveAction();

  const deletePolicy = (p: AbacPolicy) =>
    runSensitive({
      confirm: {
        title: t("abac.deleteTitle"),
        description: t("abac.deleteDescription", { name: p.name }),
        confirmLabel: t("abac.deleteLabel"),
        tone: "destructive",
      },
      actionLabel: t("abac.deleteAction").toLowerCase(),
      run: () => deleteM.mutateAsync(p.id),
    }).catch(settleSensitiveAction);
  const abacLocked = useEntitlements().data?.features.abac === false;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description="Author attribute-based policies with a no-code condition builder. Deny wins; policies are ordered by priority."
        actions={
          abacLocked ? undefined : (
            <Button size="sm" onClick={() => setDraft(newDraft())}>
              <PlusIcon /> New policy
            </Button>
          )
        }
      />

      <FeatureGate
        feature="abac"
        title="ABAC is a Pro feature"
        description="Author attribute-based access policies with a no-code condition builder. Upgrade to Pro to use ABAC."
      >
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">Policies</CardTitle>
              <CardDescription>
                {policies.length} attribute polic{policies.length === 1 ? "y" : "ies"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <DataState
                isLoading={policiesQ.isLoading}
                isError={policiesQ.isError}
                error={policiesQ.error}
                isEmpty={policies.length === 0}
                emptyIcon={SlidersHorizontalIcon}
                emptyTitle="No ABAC policies yet"
                emptyDescription="Create your first attribute-based policy."
                skeletonRows={4}
              >
                <ul className="divide-y">
                  {policies.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 p-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setDraft(draftFromPolicy(p))}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={p.effect === "deny" ? "destructive" : "success"}>
                            {p.effect}
                          </Badge>
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          {!p.enabled && <Badge variant="muted">disabled</Badge>}
                        </div>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {p.resource_type}:{p.action} · priority {p.priority}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${p.name}`}
                        disabled={deleteM.isPending}
                        onClick={() => deletePolicy(p)}
                      >
                        <TrashIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              </DataState>
            </CardContent>
          </Card>

          {draft ? (
            <PolicyEditor key={draft.id ?? "new"} draft={draft} onClose={() => setDraft(null)} />
          ) : (
            <Card className="flex min-h-100 items-center justify-center">
              <CardContent className="text-center text-sm text-muted-foreground">
                Select a policy to edit, or create a new one.
              </CardContent>
            </Card>
          )}
        </div>
      </FeatureGate>
    </div>
  );
}

/** Renders the editor for a new or existing policy, with its generated code and a dry run. */
function PolicyEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { t } = useTranslation("rbac");
  const createM = useCreateAbacPolicy();
  const updateM = useUpdateAbacPolicy(draft.id ?? "");
  const runSensitive = useSensitiveAction();
  // The condition tree is recursive, which form field paths can't type, so it is held beside the
  // form; an unusable condition blocks saving.
  const [condition, setCondition] = useState(draft.condition);
  const problem = conditionProblem(condition);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("abac.validation.name")),
        description: z.string(),
        effect: z.enum(["allow", "deny"]),
        resourceType: z.string(),
        action: z.string(),
        priority: z.number(t("abac.validation.priority")).int(t("abac.validation.priority")),
        enabled: z.boolean(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: {
      name: draft.name,
      description: draft.description,
      effect: draft.effect,
      resourceType: draft.resourceType,
      action: draft.action,
      priority: draft.priority as number | null,
      enabled: draft.enabled,
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (problem) return;
      const input = {
        name: value.name.trim(),
        description: value.description,
        effect: value.effect,
        resource_type: value.resourceType || "*",
        action: value.action || "*",
        condition: toConditionJson(condition),
        priority: value.priority ?? 0,
        enabled: value.enabled,
      };
      await runSensitive({
        actionLabel: t(draft.id ? "abac.updateAction" : "abac.createAction").toLowerCase(),
        run: () => (draft.id ? updateM.mutateAsync(input) : createM.mutateAsync(input)),
      })
        .then((saved) => saved && onClose())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err, { resource_type: "resourceType" });
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">
              {draft.id ? t("abac.editor.editTitle") : t("abac.editor.newTitle")}
            </CardTitle>
            <CardDescription>{t("abac.editor.description")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <form.AppForm>
              <form.SubmitButton disabled={!!problem}>
                {draft.id ? t("common:actions.saveChanges") : t("abac.editor.create")}
              </form.SubmitButton>
            </form.AppForm>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  label={t("abac.editor.name")}
                  placeholder="allow_eng_prod"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="effect">
              {(field) => (
                <FieldFrame label={t("abac.editor.effect")}>
                  <SegmentedControl
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as Effect)}
                    aria-label={t("abac.editor.effect")}
                  >
                    <SegmentedControlItem value="allow">
                      {t("abac.editor.allow")}
                    </SegmentedControlItem>
                    <SegmentedControlItem value="deny">
                      {t("abac.editor.deny")}
                    </SegmentedControlItem>
                  </SegmentedControl>
                </FieldFrame>
              )}
            </form.AppField>
            <form.AppField name="resourceType">
              {(field) => (
                <field.TextField
                  label={t("abac.editor.resourceType")}
                  placeholder="* or document"
                />
              )}
            </form.AppField>
            <form.AppField name="action">
              {(field) => (
                <field.TextField label={t("abac.editor.action")} placeholder="* or read" />
              )}
            </form.AppField>
            <form.AppField name="priority">
              {(field) => <field.NumberField label={t("abac.editor.priority")} step={1} />}
            </form.AppField>
            <form.AppField name="enabled">
              {(field) => <field.SwitchField label={t("abac.editor.enabled")} />}
            </form.AppField>
          </div>
          <form.AppField name="description">
            {(field) => <field.TextareaField label={t("abac.editor.descriptionLabel")} rows={2} />}
          </form.AppField>
          <div>
            <p className="mb-2 text-sm font-medium">{t("abac.editor.condition")}</p>
            <ConditionTree value={condition} onChange={setCondition} />
          </div>
          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
          <FormError error={createM.error ?? updateM.error} />
        </CardContent>
      </Card>

      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("abac.editor.previewTitle")}</CardTitle>
                <CardDescription>{t("abac.editor.previewDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <CodePreview
                  doc={draftToDoc({ ...values, condition, priority: values.priority ?? 0 })}
                  height={320}
                />
              </CardContent>
            </Card>
            <TestPanel resourceType={values.resourceType} action={values.action} />
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function defaultEvalInput(resourceType: string, action: string): string {
  return JSON.stringify(
    {
      subject: { department: "Engineering", role: "member" },
      resource: {
        type: resourceType || "document",
        id: "res-1",
        attrs: { environment: "production" },
      },
      action: action || "read",
      context: { hour_of_day: 14, mfa: true, network: "corp" },
    },
    null,
    2,
  );
}

/** Renders the dry run: a request evaluated against the live engine, explained. */
function TestPanel({ resourceType, action }: { resourceType: string; action: string }) {
  const { t } = useTranslation("rbac");
  const [raw, setRaw] = useState(() => defaultEvalInput(resourceType, action));
  const [parseError, setParseError] = useState(false);
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const simM = useAbacSimulate();

  function run() {
    let parsed: {
      subject?: Record<string, unknown>;
      resource?: { type: string; id: string; attrs?: Record<string, unknown> };
      action?: string;
      context?: Record<string, unknown>;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      setParseError(true);
      return;
    }
    setParseError(false);
    simM.mutate(
      {
        subject: parsed.subject ?? {},
        resource: parsed.resource ?? { type: resourceType || "*", id: "res-1" },
        action: parsed.action ?? (action || "*"),
        context: parsed.context ?? {},
      },
      {
        onSuccess: (rec) => {
          setRecord(rec);
          pushDecision(rec);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{t("abac.test.title")}</CardTitle>
          <CardDescription>{t("abac.test.description")}</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={run} disabled={simM.isPending}>
          {simM.isPending ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
          {t("abac.test.run")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MonacoPanel
          value={raw}
          language="json"
          readOnly={false}
          onChange={setRaw}
          height={200}
          ariaLabel={t("abac.test.input")}
        />
        {parseError && <p className="text-destructive text-sm">{t("abac.test.invalidJson")}</p>}
        {record && (
          <div className="rounded-md border p-3">
            <DecisionExplain record={record} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
