import { logger } from "@/platform/telemetry/logger";
import { redact } from "@/platform/telemetry/redact";

// Product analytics events (UX, not audit). Namespaced dotted names keep a
// consistent taxonomy (navigation.*, security.*, admin.*, ai.*, billing.*).
// Props are redacted by construction; never attach PII or secrets. The backend
// remains the authoritative source of security audit events.
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
