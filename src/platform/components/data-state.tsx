import { DataState as UiDataState, type DataStateProps, EmptyState } from "@qeetrix/ui";

import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";

/**
 * Renders `@qeetrix/ui`'s DataState with the leak stop: its error slot prints `error.message`,
 * which for an ApiError is the backend's own text, so the error is mapped to curated copy first
 * and shown with its support reference. Import this one; Biome rejects the direct import.
 */
export function DataState({ error, errorFallback, ...props }: DataStateProps) {
  const fallback =
    errorFallback ??
    (props.isError ? (
      <EmptyState
        variant="error"
        size="sm"
        description={
          <>
            {errorMessage(error)}
            <ErrorReference error={error} className="mt-1" />
          </>
        }
      />
    ) : undefined);
  return (
    <UiDataState
      {...props}
      error={error == null ? error : errorMessage(error)}
      errorFallback={fallback}
    />
  );
}
