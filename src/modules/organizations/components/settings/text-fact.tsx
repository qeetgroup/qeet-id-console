import { Button, TextField } from "@qeetrix/react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";
import { Detail, EditingDetail, Failure } from "./settings-parts";

/**
 * A text fact, changed where it sits (as My account's name): its value and Edit, or its field
 * with Cancel and Save. `check` returns the value to save, or an error to show; a value equal to
 * the saved one just closes it. A cancelled step-up keeps it open.
 */
export function TextFact({
  label,
  value,
  shown,
  hint,
  placeholder,
  maxLength,
  canEdit,
  editLabel,
  check,
  onSave,
}: {
  label: string;
  value: string;
  shown: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  maxLength: number;
  canEdit: boolean;
  editLabel: string;
  check: (raw: string) => { value: string } | { error: string };
  onSave: (value: string) => Promise<unknown>;
}) {
  const { t } = useTranslation("organizations");
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function close() {
    setEditing(false);
    setError(null);
    setFailure(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const result = check(draft);
    if ("error" in result) return setError(result.error);
    if (result.value === value) return close();
    setSaving(true);
    try {
      await onSave(result.value);
      close();
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing)
    return (
      <Detail
        label={label}
        hint={hint}
        action={
          canEdit ? (
            <Button
              variant="ghost"
              aria-label={`${editLabel} ${label.toLowerCase()}`}
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
            >
              {editLabel}
            </Button>
          ) : undefined
        }
      >
        {shown}
      </Detail>
    );

  return (
    <EditingDetail
      label={label}
      buttons={
        <>
          <Button variant="ghost" size="lg" disabled={saving} onClick={close}>
            {t("settings.cancel")}
          </Button>
          <Button size="lg" type="submit" form={formId} loading={saving}>
            {t("settings.save")}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          label={label}
          hideLabel
          maxLength={maxLength}
          placeholder={placeholder}
          autoFocus
          value={draft}
          error={error ?? undefined}
          invalid={Boolean(error)}
          disabled={saving}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
        />
        {failure && <Failure>{failure}</Failure>}
      </form>
    </EditingDetail>
  );
}
