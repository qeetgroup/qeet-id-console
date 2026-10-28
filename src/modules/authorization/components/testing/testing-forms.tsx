import { Field, TextField } from "@qeetrix/react";
import { Combobox } from "@qeetrix/react/experimental";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { BATCH_CAP } from "@/modules/authorization/api/simulate";
import { usePermissions } from "@/modules/authorization/api/rbac";
import { MonacoPanel } from "@/modules/authorization/components/shared/monaco-panel";
import { usePeople } from "@/modules/authorization/components/shared/use-people";
import type { Mode, TestForm } from "./testing-model";

export type FormErrors = Partial<Record<keyof TestForm, string>>;

type Props = {
  mode: Mode;
  batch: boolean;
  form: TestForm;
  onChange: (patch: Partial<TestForm>) => void;
  errors: FormErrors;
};

/** The person a check is about: picked by name, or by user ID without user.read. */
function PersonField({ form, onChange, errors }: Omit<Props, "mode" | "batch">) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  if (!people.canRead)
    return (
      <TextField
        label={t("testing.userId")}
        description={t("testing.userIdHint")}
        value={form.userId}
        onValueChange={(userId) => onChange({ userId })}
        placeholder="00000000-0000-0000-0000-000000000000"
        error={errors.userId}
        invalid={!!errors.userId}
        spellCheck={false}
        className="ws-mono"
      />
    );
  return (
    <Field label={t("testing.person")} error={errors.userId} invalid={!!errors.userId}>
      <Combobox<string>
        items={people.items}
        value={form.userId || null}
        onValueChange={(v) => onChange({ userId: v ?? "" })}
        placeholder={t("testing.personPlaceholder")}
      />
    </Field>
  );
}

/** Several people for one request (Run for many). */
function PeopleField({ form, onChange, errors }: Omit<Props, "mode" | "batch">) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  return (
    <Field
      label={t("testing.people")}
      description={t("testing.peopleHint", { cap: BATCH_CAP })}
      error={errors.subjects}
      invalid={!!errors.subjects}
      className="ws-span"
    >
      <Combobox<string, true>
        multiple
        items={people.items}
        value={form.subjects}
        onValueChange={(v) => onChange({ subjects: (v ?? []).slice(0, BATCH_CAP) })}
        placeholder={t("testing.personPlaceholder")}
      />
    </Field>
  );
}

/**
 * The request for each mode. Permission and Relationship ask what the composed check answers;
 * AuthZEN asks it as your apps do; Attributes takes a whole request for the attribute engine.
 */
export function RequestFields({ mode, batch, form, onChange, errors }: Props) {
  const { t } = useTranslation("authorization");
  const permissions = usePermissions();
  const permissionItems = useMemo(
    () =>
      (permissions.data?.items ?? []).map((p) => ({
        value: p.key,
        label: p.key,
        description: p.description || undefined,
      })),
    [permissions.data],
  );
  const who = batch ? (
    <PeopleField form={form} onChange={onChange} errors={errors} />
  ) : (
    <PersonField form={form} onChange={onChange} errors={errors} />
  );

  if (mode === "attributes")
    return (
      <Field
        label={t("testing.request")}
        description={t("testing.requestHint")}
        error={errors.request}
        invalid={!!errors.request}
      >
        <MonacoPanel
          value={form.request}
          language="json"
          readOnly={false}
          onChange={(request) => onChange({ request })}
          height={240}
          ariaLabel={t("testing.request")}
        />
      </Field>
    );

  if (mode === "permission")
    return (
      <div className="ws-form-grid">
        {who}
        <Field
          label={t("testing.permission")}
          error={errors.permission}
          invalid={!!errors.permission}
        >
          <Combobox<string>
            items={permissionItems}
            value={form.permission || null}
            onValueChange={(v) => onChange({ permission: v ?? "" })}
            placeholder="user.read"
          />
        </Field>
      </div>
    );

  if (mode === "relationship")
    return (
      <div className="ws-form-grid">
        {who}
        <TextField
          label={t("testing.relation")}
          value={form.relation}
          onValueChange={(relation) => onChange({ relation })}
          placeholder="viewer"
          error={errors.relation}
          invalid={!!errors.relation}
          spellCheck={false}
        />
        <TextField
          label={t("testing.object")}
          description={t("testing.objectHint")}
          value={form.object}
          onValueChange={(object) => onChange({ object })}
          placeholder="document:readme"
          error={errors.object}
          invalid={!!errors.object}
          spellCheck={false}
          className="ws-span"
        />
      </div>
    );

  return (
    <div className="ws-form-grid">
      {who}
      <TextField
        label={t("testing.action")}
        value={form.action}
        onValueChange={(action) => onChange({ action })}
        placeholder="read"
        error={errors.action}
        invalid={!!errors.action}
        spellCheck={false}
      />
      <TextField
        label={t("testing.resourceType")}
        description={t("testing.resourceTypeHint")}
        value={form.resourceType}
        onValueChange={(resourceType) => onChange({ resourceType })}
        placeholder="document"
        error={errors.resourceType}
        invalid={!!errors.resourceType}
        spellCheck={false}
      />
      <TextField
        label={t("testing.resourceId")}
        description={
          form.resourceType.trim() === "permission" ? t("testing.resourceIdPermission") : undefined
        }
        value={form.resourceId}
        onValueChange={(resourceId) => onChange({ resourceId })}
        placeholder="readme"
        error={errors.resourceId}
        invalid={!!errors.resourceId}
        spellCheck={false}
      />
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT = /^[^:\s]+:\S+$/;

/** What the request still needs, per field; empty when it can run. */
export function formErrors(
  mode: Mode,
  batch: boolean,
  form: TestForm,
  t: (
    key:
      | "testing.errors.required"
      | "testing.errors.userId"
      | "testing.errors.object"
      | "testing.errors.json"
      | "testing.errors.people",
  ) => string,
): FormErrors {
  const e: FormErrors = {};
  if (mode === "attributes") {
    try {
      const parsed: unknown = JSON.parse(form.request);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        e.request = t("testing.errors.json");
    } catch {
      e.request = t("testing.errors.json");
    }
    return e;
  }
  if (batch) {
    if (form.subjects.length === 0) e.subjects = t("testing.errors.people");
  } else if (!UUID.test(form.userId.trim())) e.userId = t("testing.errors.userId");
  if (mode === "permission" && !form.permission.trim()) e.permission = t("testing.errors.required");
  if (mode === "relationship") {
    if (!form.relation.trim()) e.relation = t("testing.errors.required");
    if (!OBJECT.test(form.object.trim())) e.object = t("testing.errors.object");
  }
  if (mode === "authzen") {
    if (!form.action.trim()) e.action = t("testing.errors.required");
    if (!form.resourceType.trim()) e.resourceType = t("testing.errors.required");
    if (form.resourceType.trim() !== "permission" && !form.resourceId.trim())
      e.resourceId = t("testing.errors.required");
  }
  return e;
}
