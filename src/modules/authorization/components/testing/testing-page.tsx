import { PlayIcon, TrashIcon, UserRoundIcon, UsersIcon } from "@qeetrix/icons";
import { Badge, Button, Link, Text, Toggle, ToggleGroup } from "@qeetrix/react";
import { Alert, CodeBlock } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAbacPolicies } from "@/modules/authorization/api/abac";
import {
  BATCH_CAP,
  type DecisionRecord,
  useAbacSimulate,
  useAuthzenEvaluate,
  useBatchSimulate,
  useRbacSimulate,
  useRebacSimulate,
} from "@/modules/authorization/api/simulate";
import { traceSteps } from "@/modules/authorization/components/explain/decision-trace";
import {
  PersonFacts,
  TraceList,
} from "@/modules/authorization/components/workspace/decision-parts";
import {
  Main,
  Output,
  Pane,
  Section,
  Workspace,
} from "@/modules/authorization/components/workspace/workspace";
import {
  clearHistory,
  pushDecision,
  useDecisionHistory,
} from "@/modules/authorization/store/authz-store";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type FormErrors, formErrors, RequestFields } from "./testing-forms";
import {
  emptyForm,
  formOf,
  MODE_OF,
  MODES,
  type Mode,
  subjectIdOf,
  type TestForm,
  traceOf,
} from "./testing-model";
import { BatchTable, DecisionView, HistoryList } from "./testing-output";
import "./testing.css";

type View = "decision" | "trace" | "response";

export type TestingPageProps = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  /** A person to ask about, from the address (a user ID). */
  userId?: string;
};

/**
 * Authorization › Testing: one page for every what-if question (it joins the Access tester,
 * Simulator and Decision explorer). Pick what to ask, ask it, and read the answer with what
 * decided it; this tab's decisions stay in the list until you sign out.
 */
export function TestingPage({ mode, onModeChange, userId = "" }: TestingPageProps) {
  const { t } = useTranslation("authorization");
  const history = useDecisionHistory();
  const [form, setForm] = useState<TestForm>(() => emptyForm(userId));
  const [errors, setErrors] = useState<FormErrors>({});
  const [batch, setBatch] = useState(false);
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const [view, setView] = useState<View>("decision");
  const permissionM = useRbacSimulate();
  const relationM = useRebacSimulate();
  const authzenM = useAuthzenEvaluate();
  const attributesM = useAbacSimulate();
  const many = useBatchSimulate();
  const mutation = {
    permission: permissionM,
    relationship: relationM,
    authzen: authzenM,
    attributes: attributesM,
  }[mode];
  const canBatch = mode !== "attributes";
  const inBatch = batch && canBatch;

  const change = (patch: Partial<TestForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof TestForm];
      return next;
    });
  };

  function done(rec: DecisionRecord) {
    setRecord(rec);
    pushDecision(rec);
    setView("decision");
  }

  function run() {
    const found = formErrors(mode, inBatch, form, (key) => t(key));
    setErrors(found);
    if (Object.keys(found).length) return;
    const user = form.userId.trim();
    if (inBatch) {
      const resource =
        mode === "permission"
          ? { type: "permission", id: "" }
          : mode === "relationship"
            ? {
                type: form.object.split(":")[0] ?? "",
                id: form.object.slice(form.object.indexOf(":") + 1),
              }
            : { type: form.resourceType.trim(), id: form.resourceId.trim() };
      const action =
        mode === "permission"
          ? form.permission.trim()
          : mode === "relationship"
            ? form.relation.trim()
            : form.action.trim();
      void many.run(
        form.subjects.map((id) => ({ type: "user", id })),
        resource,
        action,
      );
      return;
    }
    if (mode === "permission")
      permissionM.mutate(
        { user_id: user, permission: form.permission.trim() },
        { onSuccess: done },
      );
    else if (mode === "relationship")
      relationM.mutate(
        { object: form.object.trim(), relation: form.relation.trim(), user_id: user },
        { onSuccess: done },
      );
    else if (mode === "authzen")
      authzenM.mutate(
        {
          subject: { type: "user", id: user },
          resource: { type: form.resourceType.trim(), id: form.resourceId.trim() },
          action: form.action.trim(),
        },
        { onSuccess: done },
      );
    else {
      const p = JSON.parse(form.request) as Record<string, unknown>;
      attributesM.mutate(
        {
          subject: (p.subject as Record<string, unknown>) ?? {},
          resource: (p.resource as { type: string; id: string }) ?? { type: "*", id: "" },
          action: typeof p.action === "string" ? p.action : "*",
          context: (p.context as Record<string, unknown>) ?? {},
        },
        { onSuccess: done },
      );
    }
  }

  function openPast(rec: DecisionRecord) {
    setRecord(rec);
    setBatch(false);
    setForm((f) => formOf(rec, f));
    setErrors({});
    setView("decision");
    if (MODE_OF[rec.engine] !== mode) onModeChange(MODE_OF[rec.engine]);
  }

  const shown = record && MODE_OF[record.engine] === mode ? record : null;
  const steps = shown ? traceSteps(traceOf(shown).lines, traceOf(shown).composed) : [];
  const decided = many.results.filter((r) => !r.failed);
  const allowedCount = decided.filter((r) => r.allowed).length;
  const personId = (shown && subjectIdOf(shown)) || form.userId.trim();
  const asked =
    mode === "permission"
      ? form.permission
      : mode === "relationship"
        ? `${form.relation} · ${form.object}`
        : `${form.action} · ${form.resourceType}:${form.resourceId}`;

  return (
    <Workspace
      title={t("testing.title")}
      description={t("testing.description")}
      toolbarLabel={t("testing.toolbar")}
      layout={inBatch ? "list-main" : "three"}
      start={
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => {
            const next = v[0] as Mode | undefined;
            if (next && MODES.includes(next)) {
              setErrors({});
              onModeChange(next);
            }
          }}
          aria-label={t("testing.questionKind")}
        >
          {MODES.map((m) => (
            <Toggle key={m} value={m}>
              {t(`testing.modes.${m}`)}
            </Toggle>
          ))}
        </ToggleGroup>
      }
      end={
        <>
          {canBatch ? (
            <Button
              variant="soft"
              icon={inBatch ? UserRoundIcon : UsersIcon}
              onClick={() => setBatch(!inBatch)}
            >
              {inBatch ? t("testing.onePerson") : t("testing.runForMany")}
            </Button>
          ) : null}
          <Button
            icon={PlayIcon}
            onClick={run}
            loading={inBatch ? many.isRunning : mutation.isPending}
          >
            {inBatch ? t("testing.runFor", { count: form.subjects.length }) : t("testing.run")}
          </Button>
        </>
      }
    >
      <Pane
        side="list"
        label={t("testing.history")}
        meta={t("testing.historyCount", { count: history.length })}
        action={
          history.length ? (
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              icon={TrashIcon}
              onClick={() => clearHistory()}
            >
              {t("testing.clear")}
            </Button>
          ) : undefined
        }
        footer={<p className="ws-note ws-pad">{t("testing.historyNote")}</p>}
      >
        <HistoryList history={history} current={shown?.id ?? null} onOpen={openPast} />
      </Pane>
      <Main
        label={t("testing.requestLabel")}
        output={
          inBatch ? (
            <Output<"results">
              label={t("testing.results")}
              value="results"
              onValueChange={() => {}}
              tabs={[
                {
                  value: "results",
                  label: t("testing.results"),
                  badge: many.results.length || undefined,
                },
              ]}
              end={
                many.results.length ? (
                  <span className="ws-tags">
                    <Badge tone="success" size="sm">
                      {t("testing.allowedCount", { count: allowedCount })}
                    </Badge>
                    <Badge tone="danger" size="sm">
                      {t("testing.deniedCount", { count: decided.length - allowedCount })}
                    </Badge>
                  </span>
                ) : many.isRunning ? (
                  <Text size="sm" tone="subtle">
                    {t("testing.progress", {
                      done: many.progress,
                      total: Math.min(form.subjects.length, BATCH_CAP),
                    })}
                  </Text>
                ) : null
              }
            >
              <BatchTable results={many.results} asked={asked} />
            </Output>
          ) : (
            <Output<View>
              label={t("testing.answer")}
              value={view}
              onValueChange={setView}
              tabs={[
                { value: "decision", label: t("testing.decision") },
                { value: "trace", label: t("testing.trace"), badge: steps.length || undefined },
                { value: "response", label: t("testing.response") },
              ]}
            >
              {!shown ? (
                <p className="ws-note">{t("testing.answerEmpty")}</p>
              ) : view === "decision" ? (
                <DecisionView record={shown} />
              ) : view === "trace" ? (
                <TraceList steps={steps} />
              ) : (
                <CodeBlock
                  language="json"
                  title={t("testing.response")}
                  code={JSON.stringify(
                    {
                      request: shown.input,
                      response: shown.rbac ?? shown.rebac ?? shown.authzen ?? shown.abac,
                    },
                    null,
                    2,
                  )}
                />
              )}
            </Output>
          )
        }
      >
        <div className="tst-request">
          <p className="ws-note">{t(`testing.asks.${mode}`)}</p>
          {mutation.error && !inBatch ? (
            <Alert tone="danger" title={errorMessage(mutation.error)} />
          ) : null}
          <RequestFields
            mode={mode}
            batch={inBatch}
            form={form}
            onChange={change}
            errors={errors}
          />
        </div>
      </Main>
      {inBatch ? null : (
        <Pane
          side="inspector"
          label={mode === "attributes" ? t("testing.policiesChecked") : t("testing.personLabel")}
          action={
            mode !== "attributes" && personId ? (
              <Link
                href={`/users/${personId}`}
                render={<RouterLink to="/users/$userId" params={{ userId: personId }} />}
              >
                {t("testing.openProfile")}
              </Link>
            ) : undefined
          }
        >
          {mode === "attributes" ? (
            <TargetPolicies request={form.request} />
          ) : personId ? (
            <PersonFacts userId={personId} />
          ) : (
            <p className="ws-note ws-pad">{t("testing.pickPerson")}</p>
          )}
        </Pane>
      )}
    </Workspace>
  );
}

/** The enabled policies an attribute request is checked against, in the order they're checked. */
function TargetPolicies({ request }: { request: string }) {
  const { t } = useTranslation("authorization");
  const canRead = useCapabilities().can("policy.read");
  const policies = useAbacPolicies(canRead);
  if (!canRead) return <p className="ws-note ws-pad">{t("testing.noPolicyRead")}</p>;
  let type = "";
  let action = "";
  try {
    const p = JSON.parse(request) as { resource?: { type?: unknown }; action?: unknown };
    type = typeof p.resource?.type === "string" ? p.resource.type : "";
    action = typeof p.action === "string" ? p.action : "";
  } catch {
    // An unfinished request: every enabled policy shows until it parses.
  }
  const matching = (policies.data?.items ?? []).filter(
    (p) =>
      p.enabled &&
      (!type || p.resource_type === "*" || p.resource_type === type) &&
      (!action || p.action === "*" || p.action === action),
  );
  return (
    <Section label={t("testing.forTarget", { target: `${action || "*"} · ${type || "*"}` })}>
      {matching.length === 0 ? (
        <p className="ws-note">{t("testing.noPoliciesFor")}</p>
      ) : (
        <ul className="ws-list ws-order">
          {matching.map((p) => (
            <li key={p.id}>
              <RouterLink to="/authorization/abac" search={{ policy: p.id }} className="ws-row">
                <span className="ws-priority">{p.priority}</span>
                <span className="ws-row-text ws-wrap">
                  <strong>{p.name}</strong>
                  <small>{p.effect === "deny" ? t("rule.deny") : t("rule.allow")}</small>
                </span>
              </RouterLink>
            </li>
          ))}
        </ul>
      )}
      <p className="ws-note">{t("testing.orderNote")}</p>
    </Section>
  );
}
