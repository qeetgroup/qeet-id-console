import { DataState as UiDataState, type DataStateProps } from "@qeetrix/ui";

import { errorMessage } from "@/platform/errors/user-message";

/**
 * Renders `@qeetrix/ui`'s DataState with the leak stop: its error slot prints `error.message`,
 * which for an ApiError is the backend's own text, so the error is mapped to curated copy first.
 * Import this one; Biome rejects the direct import.
 */
export function DataState({ error, ...props }: DataStateProps) {
  return <UiDataState {...props} error={error == null ? error : errorMessage(error)} />;
}
