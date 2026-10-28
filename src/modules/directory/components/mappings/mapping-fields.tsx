import { TrashIcon } from "@qeetrix/icons";
import { Badge, Button, Checkbox, Field, Select, TextField } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import i18n, { isTranslationKey, type TranslationKey } from "@/i18n";
import type { DirectoryMapping, MappingInput } from "@/modules/directory/api/directory";
import {
  useDeleteDirectoryMapping,
  useSaveDirectoryMapping,
} from "@/modules/directory/api/mapping-actions";
import {
  type ConnectionKind,
  checkMapping,
  defaultSource,
  type LdapAttributes,
  TRANSFORMS,
  type Target,
} from "@/modules/directory/mappings-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { Detail } from "./mapping-parts";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

// A problem code newer than this console reads as a generic one rather than a raw key.
export function issueText(code: string): string {
  const key = `directory:mappings.issues.${code.replace(/^directory\.mapping_/, "")}`;
  return i18n.t(
    (isTranslationKey(key) ? key : "directory:mappings.issues.unknown") as TranslationKey,
  );
}

/**
 * A Profile fields row: the field, the attribute that fills it (or the connection's default, or
 * nothing), how the value is changed, and Map or Change, which opens the editor in its place.
 */
export function FieldRow({
  target,
  mapping,
  kind,
  ldap,
  canWrite,
  onEdit,
}: {
  target: Target;
  mapping: DirectoryMapping | undefined;
  kind: ConnectionKind;
  ldap?: LdapAttributes;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation("directory");
  const label = t(`mappings.fields.names.${target}`);
  const fallback = defaultSource(kind, target, ldap);
  const account = target === "email" || target === "display_name" ? target : null;

  const hint =
    target === "groups"
      ? t("mappings.fields.groupsHint")
      : account && fallback && mapping && !mapping.enabled
        ? t("mappings.fields.offDefault", { attribute: fallback })
        : account && !mapping
          ? kind === "ldap"
            ? t(`mappings.fields.fromLdap.${account}`)
            : t(`mappings.fields.fromScim.${account}`)
          : undefined;

  return (
    <Detail
      label={label}
      hint={hint}
      action={
        canWrite ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={
              mapping || fallback
                ? t("mappings.fields.changeField", { field: label })
                : t("mappings.fields.mapField", { field: label })
            }
          >
            {mapping || fallback ? t("mappings.fields.change") : t("mappings.fields.map")}
          </Button>
        ) : undefined
      }
    >
      {mapping ? (
        <span className="map-value">
          <code className={mapping.enabled ? undefined : "map-off"}>
            {mapping.source_attribute}
          </code>
          {mapping.transform !== "none" ? (
            <span className="map-how">
              {mapping.transform === "extract" ? (
                <>
                  {t("mappings.fields.transforms.extract")} <code>{mapping.pattern}</code>
                </>
              ) : (
                t(`mappings.fields.transforms.${mapping.transform}`)
              )}
            </span>
          ) : null}
          {mapping.required ? <Badge size="sm">{t("mappings.fields.required")}</Badge> : null}
          {!mapping.enabled ? <Badge size="sm">{t("mappings.fields.off")}</Badge> : null}
        </span>
      ) : fallback ? (
        <code>{fallback}</code>
      ) : (
        <span className="map-none">{t("mappings.fields.notMapped")}</span>
      )}
    </Detail>
  );
}

type Draft = Pick<
  MappingInput,
  "source_attribute" | "transform" | "pattern" | "required" | "enabled"
>;

/**
 * A field's mapping, being changed in place under the Ember bar: the attribute, how its value is
 * changed (a pattern keeps part of it), whether a missing value refuses the sign-in or change, and
 * whether it's used. Saving and removing ask the person to confirm it's them; removing is confirmed
 * first, saying what happens to people.
 */
export function FieldEditor({
  target,
  mapping,
  kind,
  connectionId,
  valueType,
  count,
  onClose,
}: {
  target: Target;
  mapping: DirectoryMapping | undefined;
  kind: ConnectionKind;
  connectionId: string;
  /** The type the field takes (the server's `targets`). */
  valueType: "string" | "array";
  /** The connection's mappings, for the server's limit of 50. */
  count: number;
  onClose: () => void;
}) {
  const { t } = useTranslation("directory");
  const runSensitive = useSensitiveAction();
  const save = useSaveDirectoryMapping(connectionId);
  const remove = useDeleteDirectoryMapping(connectionId);
  const label = t(`mappings.fields.names.${target}`);
  const [draft, setDraft] = useState<Draft>({
    source_attribute: mapping?.source_attribute ?? "",
    transform: mapping?.transform ?? "none",
    pattern: mapping?.pattern ?? "",
    required: mapping?.required ?? false,
    enabled: mapping?.enabled ?? true,
  });
  const [errors, setErrors] = useState<{ source_attribute?: string; pattern?: string }>({});
  const [failure, setFailure] = useState<{ text: string; error?: unknown } | null>(null);
  const busy = save.isPending || remove.isPending;
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors({});
    setFailure(null);
  };

  function fail(err: unknown) {
    if (err instanceof SensitiveActionCancelled) return;
    const app = normalizeError(err);
    const fields = app.fields.filter(
      (f) => f.field === "source_attribute" || f.field === "pattern",
    );
    if (fields.length) {
      setErrors(Object.fromEntries(fields.map((f) => [f.field, issueText(f.code)])));
      return;
    }
    if (app.httpStatus === 409)
      return setFailure({
        text: !mapping && count >= 50 ? t("mappings.editor.full") : t("mappings.editor.conflict"),
      });
    setFailure({ text: errorMessage(err), error: err });
  }

  async function submit() {
    const input: MappingInput = {
      ...(mapping ? { id: mapping.id, version: mapping.version } : {}),
      source_attribute: draft.source_attribute.trim(),
      target_field: target,
      value_type: valueType,
      transform: draft.transform,
      pattern: draft.transform === "extract" ? draft.pattern : "",
      enabled: draft.enabled,
      required: draft.required,
    };
    const problem = checkMapping(input, kind);
    if (problem)
      return setErrors({
        [problem.field]:
          problem.code === "source_required"
            ? t("mappings.editor.sourceRequired")
            : issueText(problem.code),
      });
    try {
      await runSensitive({
        capability: "connection.write",
        actionLabel: t("mappings.editor.saveAction"),
        run: () => save.mutateAsync(input),
      });
      onClose();
    } catch (err) {
      fail(err);
    }
  }

  function removeMapping() {
    if (!mapping) return;
    runSensitive({
      capability: "connection.write",
      confirm: {
        title: t("mappings.remove.title", { field: label }),
        description:
          kind === "ldap"
            ? t("mappings.remove.descriptionLdap", {
                field: label,
                attribute: mapping.source_attribute,
              })
            : t("mappings.remove.descriptionScim", {
                field: label,
                attribute: mapping.source_attribute,
              }),
        confirmLabel: t("mappings.remove.confirm"),
        tone: "destructive",
      },
      actionLabel: t("mappings.remove.action"),
      run: () => remove.mutateAsync(mapping.id).then(onClose),
    }).catch(settleSensitiveAction);
  }

  return (
    <div className="account-detail account-detail-open" data-editing="">
      <dt>{label}</dt>
      <dd>
        <form
          className="account-panel"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void submit();
          }}
        >
          {failure ? (
            <Alert tone="danger" title={failure.text}>
              {failure.error ? <ErrorReference error={failure.error} /> : null}
            </Alert>
          ) : null}
          <div className="account-panel-form">
            <TextField
              label={t("mappings.editor.attribute")}
              description={
                errors.source_attribute
                  ? undefined
                  : kind === "ldap"
                    ? t("mappings.editor.attributeLdap")
                    : t("mappings.editor.attributeScim")
              }
              error={errors.source_attribute}
              placeholder={
                kind === "ldap"
                  ? t("mappings.editor.placeholderLdap")
                  : t("mappings.editor.placeholderScim")
              }
              value={draft.source_attribute}
              onValueChange={(source_attribute) => set({ source_attribute })}
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <Field label={t("mappings.editor.change")}>
              <Select
                value={draft.transform}
                onValueChange={(value) => {
                  const transform = TRANSFORMS.find((x) => x === value);
                  if (transform) set({ transform });
                }}
                items={TRANSFORMS.map((x) => ({
                  value: x,
                  label: t(`mappings.editor.transforms.${x}`),
                }))}
              />
            </Field>
            {draft.transform === "extract" ? (
              <TextField
                label={t("mappings.editor.pattern")}
                description={errors.pattern ? undefined : t("mappings.editor.patternHelp")}
                error={errors.pattern}
                value={draft.pattern}
                onValueChange={(pattern) => set({ pattern })}
                maxLength={256}
                autoComplete="off"
                spellCheck={false}
              />
            ) : null}
            <Checkbox
              label={t("mappings.editor.required")}
              description={
                kind === "ldap"
                  ? t("mappings.editor.requiredLdap")
                  : t("mappings.editor.requiredScim")
              }
              checked={draft.required}
              onCheckedChange={(required) => set({ required })}
            />
            {mapping ? (
              <Checkbox
                label={t("mappings.editor.enabled")}
                description={t("mappings.editor.enabledHelp")}
                checked={draft.enabled}
                onCheckedChange={(enabled) => set({ enabled })}
              />
            ) : null}
          </div>
          <div className="account-panel-actions">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("mappings.editor.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending} disabled={remove.isPending}>
              {t("mappings.editor.save")}
            </Button>
            {mapping ? (
              <Button
                variant="ghost"
                tone="danger"
                icon={TrashIcon}
                className="map-remove"
                disabled={busy}
                onClick={removeMapping}
              >
                {t("mappings.editor.remove")}
              </Button>
            ) : null}
          </div>
        </form>
      </dd>
    </div>
  );
}
