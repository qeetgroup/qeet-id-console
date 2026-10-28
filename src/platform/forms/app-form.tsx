// The console's one way to build a form: TanStack Form bound to the @qeetrix/react fields.
// Validate with a Zod schema (`validators: { onSubmit: schema }`), submit through a mutation, and
// hand a refusal to applyServerErrors so a 422 marks the fields it names.
import { CircleAlertIcon } from "@qeetrix/icons";
import {
  Button,
  type ButtonTone,
  type ButtonVariant,
  type ControlSize,
  Field,
  Input,
  type InputProps,
  type QeetrixIcon,
  Select,
  Switch,
  Textarea,
  type TextareaProps,
} from "@qeetrix/react";
import { Alert, PasswordInput, type PasswordInputProps } from "@qeetrix/react/experimental";
import { type AnyFormApi, createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { isValidElement, type ReactNode } from "react";

import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage, fieldErrorMessages } from "@/platform/errors/user-message";

import "./app-form.css";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

// Schema validators yield Standard Schema issues ({ message }); a server error is a string. The
// same message from two validators shows once.
function errorText(errors: readonly unknown[]): string | undefined {
  const messages = errors.flat().flatMap((error): string[] => {
    if (typeof error === "string") return [error];
    if (error && typeof error === "object" && "message" in error) {
      const { message } = error as { message?: unknown };
      return typeof message === "string" && message ? [message] : [];
    }
    return [];
  });
  return messages.length ? [...new Set(messages)].join(" ") : undefined;
}

/** Returns a change handler that also drops the server's error once the person edits the value. */
export function useFieldChange<T>() {
  const field = useFieldContext<T>();
  return (value: T) => {
    if (field.state.meta.errorMap.onServer) {
      field.setMeta((meta) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }));
    }
    field.handleChange(value);
  };
}

type FieldFrameProps = {
  label: ReactNode;
  description?: ReactNode;
  // The field components set aria-required from it; nothing shows, as Qeetrix marks optional
  // fields, never required ones. The schema enforces it.
  required?: boolean;
};

/**
 * Renders the label, description and errors of the enclosing `form.AppField` around custom
 * controls, for a composite the field components don't cover. A @qeetrix/react control inside
 * is labelled by it; anything else names itself (checkboxes, each with its own label).
 */
export function FieldFrame({
  label,
  description,
  children,
}: FieldFrameProps & { children: ReactNode }) {
  const field = useFieldContext<unknown>();
  return (
    <Field
      label={label}
      description={description}
      error={errorText(field.state.meta.errors)}
      name={field.name}
    >
      {children}
    </Field>
  );
}

// The form owns these; the rest pass through to the control. `className` places the control's
// box, so a width or a monospace font given to it still applies.
type BoundProps =
  | "name"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onValueChange"
  | "onBlur"
  | "required";
type TextInputProps = Omit<InputProps, BoundProps>;

/** Renders a labelled text input bound to the enclosing `form.AppField`. */
function TextField({ label, description, required, ...input }: FieldFrameProps & TextInputProps) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description}>
      <Input
        {...input}
        value={field.state.value}
        onBlur={field.handleBlur}
        onValueChange={(value) => change(value)}
        aria-required={required || undefined}
      />
    </FieldFrame>
  );
}

/** Renders a labelled password input, with show/hide, bound to the enclosing `form.AppField`. */
function PasswordField({
  label,
  description,
  required,
  ...input
}: FieldFrameProps & Omit<PasswordInputProps, BoundProps>) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description}>
      <PasswordInput
        {...input}
        value={field.state.value}
        onBlur={field.handleBlur}
        onValueChange={(value) => change(value)}
        aria-required={required || undefined}
      />
    </FieldFrame>
  );
}

/**
 * Renders a labelled number input bound to the enclosing `form.AppField`. An empty input is
 * `null`, for an optional number.
 */
function NumberField({ label, description, required, ...input }: FieldFrameProps & TextInputProps) {
  const field = useFieldContext<number | null>();
  const change = useFieldChange<number | null>();
  return (
    <FieldFrame label={label} description={description}>
      <Input
        {...input}
        type="number"
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => change(e.target.value === "" ? null : e.target.valueAsNumber)}
        aria-required={required || undefined}
      />
    </FieldFrame>
  );
}

/** Renders a labelled multi-line text input bound to the enclosing `form.AppField`. */
function TextareaField({
  label,
  description,
  required,
  ...textarea
}: FieldFrameProps & Omit<TextareaProps, BoundProps>) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description}>
      <Textarea
        {...textarea}
        value={field.state.value}
        onBlur={field.handleBlur}
        onValueChange={(value) => change(value)}
        aria-required={required || undefined}
      />
    </FieldFrame>
  );
}

/**
 * Renders an on/off setting: the switch, then its label and description. An error takes the
 * description's place, so the switch is described by it.
 */
function SwitchField({
  label,
  description,
  disabled,
}: Omit<FieldFrameProps, "required"> & { disabled?: boolean }) {
  const field = useFieldContext<boolean>();
  const change = useFieldChange<boolean>();
  const error = errorText(field.state.meta.errors);
  return (
    <Switch
      label={label}
      description={
        error ? (
          <span className="app-form-error" data-slot="field-error">
            <CircleAlertIcon shape="sharp" size={16} aria-hidden className="app-form-error-icon" />
            <span>{error}</span>
          </span>
        ) : (
          description
        )
      }
      name={field.name}
      checked={field.state.value}
      onCheckedChange={(checked) => change(checked)}
      onBlur={field.handleBlur}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
    />
  );
}

type SelectFieldProps = FieldFrameProps & {
  options: { value: string; label: ReactNode }[];
  placeholder?: ReactNode;
  disabled?: boolean;
};

/** Renders a labelled single-choice select bound to the enclosing `form.AppField`. */
function SelectField({ options, placeholder, disabled, ...frame }: SelectFieldProps) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame {...frame}>
      <Select
        items={options}
        value={field.state.value}
        onValueChange={(value) => value != null && change(value)}
        onOpenChange={(open) => {
          if (!open) field.handleBlur();
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
    </FieldFrame>
  );
}

// The old kit's variants that forms still pass map onto Qeetrix's actions: an outline or
// secondary button is the graphite one, a destructive one the danger tone.
type LegacyVariant = "default" | "outline" | "secondary" | "destructive" | "link";
type SubmitVariant = ButtonVariant | LegacyVariant;

function look(variant: SubmitVariant | undefined): { variant: ButtonVariant; tone?: ButtonTone } {
  switch (variant) {
    case "outline":
    case "secondary":
    case "soft":
      return { variant: "soft" };
    case "ghost":
    case "link":
      return { variant: "ghost" };
    case "destructive":
      return { variant: "solid", tone: "danger" };
    default:
      return { variant: "solid" };
  }
}

// A trailing icon given as a component (`PlayIcon`) or an element (`<PlayIcon />`): the button
// draws it sharp at its own size, so only the component is kept.
function iconOf(icon: ReactNode | QeetrixIcon): QeetrixIcon | undefined {
  if (typeof icon === "function") return icon;
  if (isValidElement(icon) && typeof icon.type === "function") return icon.type as QeetrixIcon;
  return undefined;
}

/**
 * Renders the form's submit button, busy while the submission runs and, with `requireChanges`,
 * off until a value differs from the form's defaults. `lg` by default, to line up with the fields.
 */
function SubmitButton({
  children,
  pendingLabel,
  icon,
  disabled,
  variant,
  size = "lg",
  requireChanges,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  icon?: ReactNode | QeetrixIcon;
  disabled?: boolean;
  variant?: SubmitVariant;
  size?: ControlSize;
  requireChanges?: boolean;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.isSubmitting, state.isDefaultValue] as const}>
      {([isSubmitting, isDefaultValue]) => (
        <Button
          type="submit"
          {...look(variant)}
          size={size}
          icon={iconOf(icon)}
          loading={isSubmitting}
          disabled={disabled || (requireChanges && isDefaultValue)}
        >
          {isSubmitting && pendingLabel ? pendingLabel : children}
        </Button>
      )}
    </form.Subscribe>
  );
}

/** Renders a button that puts every field back to the form's defaults; off until one differs. */
function ResetButton({ children, size = "lg" }: { children: ReactNode; size?: ControlSize }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.isSubmitting, state.isDefaultValue] as const}>
      {([isSubmitting, isDefaultValue]) => (
        <Button
          type="button"
          variant="ghost"
          size={size}
          disabled={isSubmitting || isDefaultValue}
          onClick={() => form.reset()}
        >
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    NumberField,
    TextareaField,
    PasswordField,
    SelectField,
    SwitchField,
  },
  formComponents: { SubmitButton, ResetButton },
});

/**
 * Marks each field a 422 rejected with copy for its code. `names` maps a request body key to
 * the form field holding it, where the two differ.
 */
export function applyServerErrors(
  form: AnyFormApi,
  err: unknown,
  names: Record<string, string> = {},
): void {
  for (const [key, message] of Object.entries(fieldErrorMessages(err))) {
    const name = names[key] ?? key;
    if (!(name in form.fieldInfo)) continue;
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: message },
    }));
  }
}

/** Renders a failed submission's user-safe message and support reference, or nothing. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert tone="danger" title={errorMessage(error)} announce="urgent">
      <ErrorReference error={error} />
    </Alert>
  );
}
