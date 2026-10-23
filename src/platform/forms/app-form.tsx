// The console's one way to build a form: TanStack Form bound to the @qeetrix/ui field family.
// Validate with a Zod schema (`validators: { onSubmit: schema }`), submit through a mutation, and
// hand a refusal to applyServerErrors so a 422 marks the fields it names.
import {
  Button,
  Field,
  FieldContent,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  PasswordInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@qeetrix/ui";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { type AnyFormApi, createFormHook, createFormHookContexts } from "@tanstack/react-form";
import type { ComponentProps, ReactNode } from "react";

import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage, fieldErrorMessages } from "@/platform/errors/user-message";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

type Message = { message?: string };

// Schema validators yield Standard Schema issues ({ message }); a server error is a string.
function messagesOf(errors: readonly unknown[]): Message[] {
  return errors.flat().flatMap((error): Message[] => {
    if (typeof error === "string") return [{ message: error }];
    if (error && typeof error === "object" && "message" in error) return [error as Message];
    return [];
  });
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
  required?: boolean; // marks the label; the schema enforces it
};

/**
 * Renders the label, description and errors of the enclosing `form.AppField` around custom
 * controls, for a composite the field components don't cover. Wrap its input in FieldControl.
 */
export function FieldFrame({
  label,
  description,
  required,
  children,
}: FieldFrameProps & { children: ReactNode }) {
  const field = useFieldContext<unknown>();
  const errors = messagesOf(field.state.meta.errors);
  return (
    <Field invalid={errors.length > 0}>
      <FieldLabel>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={errors} />
    </Field>
  );
}

// The form owns these; the rest pass through to the control.
type BoundProps = "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "required";
type InputProps = Omit<ComponentProps<typeof Input>, BoundProps>;

/** Renders a labelled text input bound to the enclosing `form.AppField`. */
function TextField({ label, description, required, ...input }: FieldFrameProps & InputProps) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description} required={required}>
      <FieldControl
        render={
          <Input
            {...input}
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => change(e.target.value)}
            aria-required={required || undefined}
          />
        }
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
}: FieldFrameProps & Omit<ComponentProps<typeof PasswordInput>, BoundProps>) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description} required={required}>
      <FieldControl
        render={
          <PasswordInput
            {...input}
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => change(e.target.value)}
            aria-required={required || undefined}
          />
        }
      />
    </FieldFrame>
  );
}

/**
 * Renders a labelled number input bound to the enclosing `form.AppField`. An empty input is
 * `null`, for an optional number.
 */
function NumberField({ label, description, required, ...input }: FieldFrameProps & InputProps) {
  const field = useFieldContext<number | null>();
  const change = useFieldChange<number | null>();
  return (
    <FieldFrame label={label} description={description} required={required}>
      <FieldControl
        render={
          <Input
            {...input}
            type="number"
            name={field.name}
            value={field.state.value ?? ""}
            onBlur={field.handleBlur}
            onChange={(e) => change(e.target.value === "" ? null : e.target.valueAsNumber)}
            aria-required={required || undefined}
          />
        }
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
}: FieldFrameProps & Omit<ComponentProps<typeof Textarea>, BoundProps>) {
  const field = useFieldContext<string>();
  const change = useFieldChange<string>();
  return (
    <FieldFrame label={label} description={description} required={required}>
      <FieldControl
        render={
          <Textarea
            {...textarea}
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => change(e.target.value)}
            aria-required={required || undefined}
          />
        }
      />
    </FieldFrame>
  );
}

/** Renders an on/off setting, its label and description beside the switch. */
function SwitchField({
  label,
  description,
  disabled,
}: Omit<FieldFrameProps, "required"> & { disabled?: boolean }) {
  const field = useFieldContext<boolean>();
  const change = useFieldChange<boolean>();
  const errors = messagesOf(field.state.meta.errors);
  return (
    <Field orientation="horizontal" invalid={errors.length > 0} className="justify-between gap-4">
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        <FieldError errors={errors} />
      </FieldContent>
      <FieldControl
        render={
          <Switch
            checked={field.state.value}
            onCheckedChange={change}
            onBlur={field.handleBlur}
            disabled={disabled}
          />
        }
      />
    </Field>
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
        value={field.state.value}
        onValueChange={(value) => value != null && change(value)}
        disabled={disabled}
      >
        <FieldControl
          render={
            <SelectTrigger onBlur={field.handleBlur}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
          }
        />
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldFrame>
  );
}

/**
 * Renders the form's submit button, disabled with a spinner while the submission runs and, with
 * `requireChanges`, until a value differs from the form's defaults.
 */
function SubmitButton({
  children,
  pendingLabel,
  icon,
  disabled,
  variant,
  requireChanges,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  requireChanges?: boolean;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.isSubmitting, state.isDefaultValue] as const}>
      {([isSubmitting, isDefaultValue]) => (
        <Button
          type="submit"
          variant={variant}
          disabled={isSubmitting || disabled || (requireChanges && isDefaultValue)}
        >
          {isSubmitting ? <LoaderCircleIcon className="animate-spin" /> : icon}
          {isSubmitting && pendingLabel ? pendingLabel : children}
        </Button>
      )}
    </form.Subscribe>
  );
}

/** Renders a button that puts every field back to the form's defaults; off until one differs. */
function ResetButton({ children }: { children: ReactNode }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.isSubmitting, state.isDefaultValue] as const}>
      {([isSubmitting, isDefaultValue]) => (
        <Button
          type="button"
          variant="outline"
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
    <Field>
      <FieldError>
        {errorMessage(error)}
        <ErrorReference error={error} />
      </FieldError>
    </Field>
  );
}
