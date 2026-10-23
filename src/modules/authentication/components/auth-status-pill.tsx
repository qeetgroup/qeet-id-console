import { StatusPill, type StatusPillProps } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

// The kit's StatusPill names a known status in English, so the statuses these pages show are
// named through the catalogue. Any other status keeps the kit's own label.
const STATUS_KEYS: Record<string, string> = {
  active: "auth:status.active",
  inactive: "auth:status.inactive",
  draft: "auth:status.draft",
  pending: "auth:status.pending",
  disabled: "auth:status.disabled",
  suspended: "auth:status.suspended",
  revoked: "auth:status.revoked",
  expired: "auth:status.expired",
  deleted: "auth:status.deleted",
};

/** Renders a StatusPill whose status word is translated. */
export function AuthStatusPill({ status, children, ...props }: StatusPillProps) {
  const { t } = useTranslation("auth");
  const key = status ? STATUS_KEYS[status.toLowerCase()] : undefined;
  return (
    <StatusPill status={status} {...props}>
      {children ?? (key ? t(key) : undefined)}
    </StatusPill>
  );
}
