import { cn } from "@qeetrix/ui";

import { errorMessage, errorReference } from "@/platform/errors/user-message";

/**
 * Renders a failed request's support reference, the id the backend logged it under, or nothing
 * when the error has none. One click selects the id for copying.
 */
export function ErrorReference({ error, className }: { error: unknown; className?: string }) {
  const requestId = errorReference(error);
  if (!requestId) return null;
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      Reference: <span className="select-all font-mono">{requestId}</span>
    </span>
  );
}

/** Renders an error's user-safe message followed by its support reference. */
export function ErrorText({ error }: { error: unknown }) {
  return (
    <>
      {errorMessage(error)}
      <ErrorReference error={error} className="mt-1" />
    </>
  );
}
