import { Field } from "@qeetrix/react";
import { Alert, Combobox } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage, fieldErrorMessages } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { CONSOLE_CAPABILITIES, capabilityLabel } from "@/platform/security/capability-model";
import { useSecrets } from "../api/secrets";

/** A form field's first message, from its schema check or the server, for the field's `error`. */
export function fieldError(errors: readonly unknown[]): string | undefined {
  for (const error of errors.flat()) {
    if (typeof error === "string" && error) return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return undefined;
}

/**
 * A refused submission at the top of a drawer: its user-safe message and support reference. A
 * refusal that only names fields (a 422 the fields show) shows nothing here.
 */
export function FormFailure({ error }: { error: unknown }) {
  if (!error) return null;
  if (Object.keys(fieldErrorMessages(error)).length) return null;
  return (
    <Alert tone="danger" title={errorMessage(error)}>
      <ErrorReference error={error} />
    </Alert>
  );
}

/**
 * The scopes a credential can be given: the server's built-in permissions and, for the secrets
 * vault, `vault:read` and `vault:<name>` for each secret. The server lets you grant only scopes
 * you hold yourself, so the others are listed but can't be chosen.
 */
export function useScopeItems() {
  const { t } = useTranslation("developer");
  const access = useCapabilities();
  const secrets = useSecrets(access.can("secret.read"));
  return [
    ...CONSOLE_CAPABILITIES.map((scope) => ({
      value: scope,
      label: scope,
      description: access.can(scope) ? capabilityLabel(scope) : t("scopes.notYours"),
      disabled: !access.can(scope),
    })),
    { value: "vault:read", label: "vault:read", description: t("scopes.vaultAll") },
    ...(secrets.data?.items ?? []).map((s) => ({
      value: `vault:${s.name}`,
      label: `vault:${s.name}`,
      description: t("scopes.vaultOne", { name: s.name }),
    })),
  ];
}

/** Choose scopes: a searchable list, chosen ones as pills. */
export function ScopesField({
  value,
  onChange,
  description,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  description: string;
  error?: string;
}) {
  const { t } = useTranslation("developer");
  const items = useScopeItems();
  return (
    <Field label={t("scopes.label")} description={error ? undefined : description} error={error}>
      <Combobox<string, true>
        multiple
        items={items}
        value={value}
        onValueChange={(next) => onChange([...(next ?? [])])}
        placeholder={t("scopes.placeholder")}
      />
    </Field>
  );
}
