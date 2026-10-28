import i18n, { type TranslationKey } from "@/i18n";

/** One row the backend refused in a bulk import. Its `message` is backend text and never kept. */
export type ImportRowError = {
  line?: number; // the row's line in the file
  email?: string;
  code: string;
  field?: string; // the row's JSON field at fault
};

// Each reads `users:import.rowErrors.<key>`.
type RowErrorKey =
  | "fieldMissing"
  | "fieldInvalid"
  | "fieldTooLong"
  | "rowMalformed"
  | "fileMalformed"
  | "sourceInvalid"
  | "emailExists"
  | "domainManaged"
  | "passwordTooShort"
  | "passwordNoUppercase"
  | "passwordNoNumber"
  | "passwordNoSymbol"
  | "passwordBreached"
  | "passwordWeak"
  | "unknown";

const ROW_ERROR_KEYS: Record<string, RowErrorKey> = {
  "user.import_field_missing": "fieldMissing",
  "user.import_field_invalid": "fieldInvalid",
  "user.import_field_too_long": "fieldTooLong",
  "user.import_row_malformed": "rowMalformed",
  "user.import_source_invalid": "sourceInvalid",
  "auth.email_exists": "emailExists",
  "user.domain_managed_elsewhere": "domainManaged",
  "authpolicy.password_too_short": "passwordTooShort",
  "authpolicy.password_no_uppercase": "passwordNoUppercase",
  "authpolicy.password_no_number": "passwordNoNumber",
  "authpolicy.password_no_symbol": "passwordNoSymbol",
  "authpolicy.password_breached": "passwordBreached",
  "auth.password_weak": "passwordWeak",
};

const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  email: "users:import.colEmail",
  display_name: "users:import.colName",
  phone: "users:import.colPhone",
  password: "users:import.colPassword",
};

/** Returns the console's wording for a refused import row, keyed on its code and field. */
export function importRowErrorMessage(error: ImportRowError): string {
  let key = ROW_ERROR_KEYS[error.code] ?? "unknown";
  // With no line, the whole file failed to parse rather than one row.
  if (key === "rowMalformed" && !error.line) key = "fileMalformed";
  const labelKey = error.field ? FIELD_LABEL_KEYS[error.field] : undefined;
  const field = labelKey
    ? i18n.t(labelKey)
    : (error.field ?? i18n.t("users:import.rowErrors.aField"));
  return i18n.t(`users:import.rowErrors.${key}`, { field });
}
