import { EmptyState, type EmptyStateProps } from "@qeetrix/react/experimental";

/**
 * A page that is only a message, centred in the page area: not found, no access, an error. Its
 * title is the page's one heading.
 */
export function StatePage(props: Omit<EmptyStateProps, "level" | "size">) {
  return (
    <div className="console-state">
      <EmptyState level={1} size="page" {...props} />
    </div>
  );
}
