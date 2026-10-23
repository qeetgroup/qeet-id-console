import type { ToolExecution } from "../../tools/types/tool.types";
import { ToolCallCard } from "./tool-call-card";

/**
 * Renders one assistant turn's tool executions in order, with a retry button when `onRetry` is
 * given. The turn's "thinking" phase is the message's streaming indicator, not shown here.
 */
export function ExecutionTimeline({
  executions,
  onRetry,
}: {
  executions: ToolExecution[];
  onRetry?: (executionId: string) => void;
}) {
  if (executions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {executions.map((execution) => (
        <ToolCallCard
          key={execution.id}
          execution={execution}
          onRetry={onRetry ? () => onRetry(execution.id) : undefined}
        />
      ))}
    </div>
  );
}
