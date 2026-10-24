import { type StatusPillProps, StatusPill as UiStatusPill } from "@qeetrix/ui";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

// Every status the console shows without its own label, lowercased as the kit matches them.
const STATUS_KEYS: Record<string, ParseKeys<"common">> = {
  active: "status.active",
  ok: "status.ok",
  accepted: "status.accepted",
  authorized: "status.authorized",
  recorded: "status.recorded",
  invited: "status.invited",
  pending: "status.pending",
  inactive: "status.inactive",
  draft: "status.draft",
  retired: "status.retired",
  disabled: "status.disabled",
  suspended: "status.suspended",
  revoked: "status.revoked",
  expired: "status.expired",
  deleted: "status.deleted",
  declined: "status.declined",
  denied: "status.denied",
};

/**
 * Renders `@qeetrix/ui`'s StatusPill with its status word translated: the kit names a known
 * status in English. A caller's children win, and a status with no key keeps the kit's label.
 * Import this one; Biome rejects the direct import.
 */
export function StatusPill({ status, children, ...props }: StatusPillProps) {
  const { t } = useTranslation("common");
  const word = status?.toLowerCase();
  const key = word && Object.hasOwn(STATUS_KEYS, word) ? STATUS_KEYS[word] : undefined;
  return (
    <UiStatusPill status={status} {...props}>
      {children ?? (key ? t(key) : undefined)}
    </UiStatusPill>
  );
}
