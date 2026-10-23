import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Switch,
} from "@qeetrix/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { MappingInput } from "../api/directory";
import { DirectorySelect } from "./directory-ui";

export function MappingEditor({
  initial,
  targets,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: MappingInput;
  targets: Record<string, "string" | "array">;
  busy: boolean;
  error?: string;
  onSave: (mapping: MappingInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("directory");
  const [mapping, setMapping] = useState(initial);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(initial.id ? "directory.mappings.edit" : "directory.mappings.add")}
          </DialogTitle>
          <DialogDescription>{t("directory.mappings.editorDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && mapping.source_attribute.trim())
              onSave({ ...mapping, source_attribute: mapping.source_attribute.trim() });
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="mapping-source-field">
                {t("directory.mappings.source")}
              </FieldLabel>
              <Input
                id="mapping-source-field"
                required
                maxLength={128}
                value={mapping.source_attribute}
                onChange={(event) =>
                  setMapping({ ...mapping, source_attribute: event.target.value })
                }
              />
            </Field>
            <DirectorySelect
              label={t("directory.mappings.target")}
              value={mapping.target_field}
              onChange={(target_field) =>
                setMapping({
                  ...mapping,
                  target_field,
                  value_type: targets[target_field] ?? "string",
                })
              }
              options={Object.keys(targets).map((value) => ({
                value,
                label: t(`directory.mappings.targets.${value}`, { defaultValue: value }),
              }))}
            />
            <DirectorySelect
              label={t("directory.mappings.transform")}
              value={mapping.transform}
              onChange={(transform) =>
                setMapping({
                  ...mapping,
                  transform: transform as MappingInput["transform"],
                  pattern: transform === "extract" ? mapping.pattern : "",
                })
              }
              options={(["none", "trim", "lowercase", "uppercase", "extract"] as const).map(
                (value) => ({
                  value,
                  label: t(`directory.mappings.transformOptions.${value}`),
                }),
              )}
            />
            {mapping.transform === "extract" ? (
              <Field>
                <FieldLabel htmlFor="mapping-pattern">{t("directory.mappings.pattern")}</FieldLabel>
                <Input
                  id="mapping-pattern"
                  className="font-mono"
                  required
                  maxLength={256}
                  value={mapping.pattern}
                  onChange={(event) => setMapping({ ...mapping, pattern: event.target.value })}
                />
              </Field>
            ) : null}
            <div className="flex items-center justify-between">
              <label htmlFor="mapping-enabled" className="text-sm">
                {t("directory.mappings.activeLabel")}
              </label>
              <Switch
                id="mapping-enabled"
                checked={mapping.enabled}
                onCheckedChange={(enabled) => setMapping({ ...mapping, enabled })}
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="mapping-required" className="text-sm">
                {t("directory.mappings.required")}
              </label>
              <Switch
                id="mapping-required"
                checked={mapping.required}
                onCheckedChange={(required) => setMapping({ ...mapping, required })}
              />
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={busy || !mapping.source_attribute.trim()}>
                {t("directory.mappings.save")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
