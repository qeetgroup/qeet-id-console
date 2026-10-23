import { logger } from "@/platform/telemetry/logger";
import { redact } from "@/platform/telemetry/redact";

// Product analytics (UX only: the backend owns security audit events). Names are dotted
// namespaces such as navigation.* or security.*; props are redacted, but never attach PII.
export type AnalyticsEvent = {
  name: `${string}.${string}`;
  props?: Record<string, string | number | boolean | null | undefined>;
};

export function track(event: AnalyticsEvent) {
  logger.debug(
    `event:${event.name}`,
    event.props ? (redact(event.props) as Record<string, unknown>) : undefined,
  );
}
