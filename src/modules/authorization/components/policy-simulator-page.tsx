import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SegmentedControl,
  SegmentedControlItem,
} from "@qeetrix/ui";
import { FlaskConicalIcon, PlayIcon } from "@qeetrix/icons";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  type DecisionRecord,
  type Engine,
  useAbacSimulate,
  useAuthzenEvaluate,
  useRbacSimulate,
  useRebacSimulate,
} from "../api/simulate";
import { pushDecision } from "../store/authz-store";
import { BatchSimulationCard } from "./batch-simulation-card";
import { DecisionExplain } from "./explain/decision-explain";
import { MonacoPanel } from "./shared/monaco-panel";

const ENGINES: Engine[] = ["authzen", "abac", "rbac", "rebac"];

const DEFAULT_ABAC_INPUT = JSON.stringify(
  {
    subject: { department: "Engineering" },
    resource: { type: "document", id: "res-1", attrs: { environment: "production" } },
    action: "read",
    context: { hour_of_day: 14, mfa: true },
  },
  null,
  2,
);

type OnResult = (record: DecisionRecord) => void;

/** Renders the policy simulator: a what-if request to any engine, and its explained decision. */
export function PolicySimulatorPage() {
  const { t } = useTranslation("rbac");
  const [engine, setEngine] = useState<Engine>("authzen");
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  // Each decision is also kept for the Decision Explorer.
  const onResult = (r: DecisionRecord) => {
    setRecord(r);
    pushDecision(r);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("simulator.description")} />

      <SegmentedControl
        value={engine}
        onValueChange={(v) => setEngine(v as Engine)}
        aria-label={t("simulator.engine")}
      >
        {ENGINES.map((e) => (
          <SegmentedControlItem key={e} value={e}>
            {t(`simulator.engines.${e}.label`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p className="-mt-1 text-xs text-muted-foreground">
        {t(`simulator.engines.${engine}.description`)}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("simulator.request.title")}</CardTitle>
            <CardDescription>{t("simulator.request.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {engine === "authzen" && <AuthzenForm onResult={onResult} />}
            {engine === "abac" && <AbacForm onResult={onResult} />}
            {engine === "rbac" && <RbacForm onResult={onResult} />}
            {engine === "rebac" && <RebacForm onResult={onResult} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("simulator.decision.title")}</CardTitle>
            <CardDescription>{t("simulator.decision.description")}</CardDescription>
          </CardHeader>
          <CardContent aria-live="polite">
            {record ? (
              <DecisionExplain record={record} />
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <FlaskConicalIcon className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">{t("simulator.decision.empty")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {engine === "authzen" && <BatchSimulationCard />}
    </div>
  );
}

// A simulation form's frame: its fields, the failure, and the run button.
function SimulationForm({
  onSubmit,
  error,
  submit,
  children,
}: {
  onSubmit: () => void;
  error: unknown;
  submit: ReactNode;
  children: ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <FormError error={error} />
      <div className="self-start">{submit}</div>
    </form>
  );
}

function useRequired() {
  const { t } = useTranslation("rbac");
  return useMemo(() => z.string().trim().min(1, t("simulator.validation.required")), [t]);
}

function AuthzenForm({ onResult }: { onResult: OnResult }) {
  const { t } = useTranslation("rbac");
  const m = useAuthzenEvaluate();
  const required = useRequired();
  const form = useAppForm({
    defaultValues: {
      subjectType: "user",
      subjectId: "",
      resourceType: "document",
      resourceId: "",
      action: "read",
    },
    validators: {
      onSubmit: z.object({
        subjectType: required,
        subjectId: required,
        resourceType: required,
        resourceId: required,
        action: required,
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      await m
        .mutateAsync({
          subject: { type: value.subjectType.trim(), id: value.subjectId.trim() },
          resource: { type: value.resourceType.trim(), id: value.resourceId.trim() },
          action: value.action.trim(),
        })
        .then(onResult)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <SimulationForm
      onSubmit={() => void form.handleSubmit()}
      error={m.error}
      submit={
        <form.AppForm>
          <form.SubmitButton icon={<PlayIcon />}>{t("simulator.run")}</form.SubmitButton>
        </form.AppForm>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <form.AppField name="subjectType">
          {(field) => <field.TextField label={t("simulator.fields.subjectType")} required />}
        </form.AppField>
        <form.AppField name="subjectId">
          {(field) => (
            <field.TextField
              label={t("simulator.fields.subjectId")}
              className="font-mono text-xs"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="resourceType">
          {(field) => <field.TextField label={t("simulator.fields.resourceType")} required />}
        </form.AppField>
        <form.AppField name="resourceId">
          {(field) => (
            <field.TextField
              label={t("simulator.fields.resourceId")}
              className="font-mono text-xs"
              required
            />
          )}
        </form.AppField>
      </div>
      <form.AppField name="action">
        {(field) => <field.TextField label={t("simulator.fields.action")} required />}
      </form.AppField>
    </SimulationForm>
  );
}

function RbacForm({ onResult }: { onResult: OnResult }) {
  const { t } = useTranslation("rbac");
  const m = useRbacSimulate();
  const required = useRequired();
  const form = useAppForm({
    defaultValues: { userId: "", permission: "" },
    validators: { onSubmit: z.object({ userId: required, permission: required }) },
    onSubmit: async ({ value, formApi }) => {
      await m
        .mutateAsync({ user_id: value.userId.trim(), permission: value.permission.trim() })
        .then(onResult)
        .catch((err: unknown) => applyServerErrors(formApi, err, { user_id: "userId" }));
    },
  });

  return (
    <SimulationForm
      onSubmit={() => void form.handleSubmit()}
      error={m.error}
      submit={
        <form.AppForm>
          <form.SubmitButton icon={<PlayIcon />}>{t("simulator.run")}</form.SubmitButton>
        </form.AppForm>
      }
    >
      <form.AppField name="userId">
        {(field) => (
          <field.TextField
            label={t("simulator.fields.userId")}
            className="font-mono text-xs"
            required
          />
        )}
      </form.AppField>
      <form.AppField name="permission">
        {(field) => (
          <field.TextField
            label={t("simulator.fields.permission")}
            placeholder="user.read"
            required
          />
        )}
      </form.AppField>
    </SimulationForm>
  );
}

function RebacForm({ onResult }: { onResult: OnResult }) {
  const { t } = useTranslation("rbac");
  const m = useRebacSimulate();
  const required = useRequired();
  const form = useAppForm({
    defaultValues: { object: "", relation: "", userId: "" },
    validators: { onSubmit: z.object({ object: required, relation: required, userId: required }) },
    onSubmit: async ({ value, formApi }) => {
      await m
        .mutateAsync({
          object: value.object.trim(),
          relation: value.relation.trim(),
          user_id: value.userId.trim(),
        })
        .then(onResult)
        .catch((err: unknown) => applyServerErrors(formApi, err, { user_id: "userId" }));
    },
  });

  return (
    <SimulationForm
      onSubmit={() => void form.handleSubmit()}
      error={m.error}
      submit={
        <form.AppForm>
          <form.SubmitButton icon={<PlayIcon />}>{t("simulator.run")}</form.SubmitButton>
        </form.AppForm>
      }
    >
      <form.AppField name="object">
        {(field) => (
          <field.TextField
            label={t("simulator.fields.object")}
            placeholder="document:readme"
            required
          />
        )}
      </form.AppField>
      <form.AppField name="relation">
        {(field) => (
          <field.TextField label={t("simulator.fields.relation")} placeholder="viewer" required />
        )}
      </form.AppField>
      <form.AppField name="userId">
        {(field) => (
          <field.TextField
            label={t("simulator.fields.userId")}
            className="font-mono text-xs"
            required
          />
        )}
      </form.AppField>
    </SimulationForm>
  );
}

type AbacRequest = {
  subject?: Record<string, unknown>;
  resource?: { type: string; id: string; attrs?: Record<string, unknown> };
  action?: string;
  context?: Record<string, unknown>;
};

function parseAbacRequest(raw: string): AbacRequest | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AbacRequest)
      : null;
  } catch {
    return null;
  }
}

function AbacForm({ onResult }: { onResult: OnResult }) {
  const { t } = useTranslation("rbac");
  const m = useAbacSimulate();
  const schema = useMemo(
    () =>
      z.object({
        input: z
          .string()
          .refine((v) => parseAbacRequest(v) !== null, t("simulator.validation.json")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { input: DEFAULT_ABAC_INPUT },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const p = parseAbacRequest(value.input) ?? {};
      await m
        .mutateAsync({
          subject: p.subject ?? {},
          resource: p.resource ?? { type: "*", id: "res-1" },
          action: p.action ?? "*",
          context: p.context ?? {},
        })
        .then(onResult)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });

  return (
    <SimulationForm
      onSubmit={() => void form.handleSubmit()}
      error={m.error}
      submit={
        <form.AppForm>
          <form.SubmitButton icon={<PlayIcon />}>{t("simulator.run")}</form.SubmitButton>
        </form.AppForm>
      }
    >
      <form.Field name="input">
        {(field) => (
          <>
            <MonacoPanel
              value={field.state.value}
              language="json"
              readOnly={false}
              onChange={field.handleChange}
              height={220}
              ariaLabel={t("simulator.fields.abacInput")}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-destructive text-sm">{t("simulator.validation.json")}</p>
            )}
          </>
        )}
      </form.Field>
    </SimulationForm>
  );
}
