// A form field's error in words, for a @qeetrix/react field bound to the enclosing form (useAppForm):
// the schema's message (a Standard Schema issue) or the server's, which applyServerErrors sets.

type FieldLike = { state: { meta: { errors: readonly unknown[] } } };

export function fieldError(field: FieldLike): string | undefined {
  for (const error of field.state.meta.errors.flat()) {
    if (typeof error === "string" && error) return error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return undefined;
}
