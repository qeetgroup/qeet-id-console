import { ArrowRightIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  Link,
  Text,
} from "@qeetrix/react";
import { DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import {
  type DirectoryConnection,
  formatDirectoryDuration,
} from "@/modules/directory/directory-model";
import { causeOf, runKey } from "@/modules/directory/sync-model";
import { RESULT_TONE } from "./activity-band";
import { useChanged, useConnectionNames, whenText } from "./sync-parts";

/** What a run was about, in words: a person (with their page), a group, the connection. */
export function useAbout() {
  const { t } = useTranslation("directory");
  return (e: DirectoryEvent) => {
    if (e.resource_type === "group") return t("sync.about.group");
    if (e.resource_type === "connection") return t("sync.about.connection");
    if (e.operation === "sign-in") return t("sync.about.signIn");
    if (!e.resource_id) return t("sync.about.newPerson");
    return t("sync.about.person");
  };
}

/**
 * One run, opened from its row: how it ended and why, who started it, what it was about and
 * changed, how long it took; for a failure, the server's code and message for the directory's
 * administrator, where the failure stands, and the way to it on Sync errors.
 */
export function ActivityDrawer({
  open,
  event,
  connections,
  now,
  onClose,
  onOpenErrors,
}: {
  open: boolean;
  /** The run on show; it stays while the drawer closes. */
  event: DirectoryEvent | null;
  connections: readonly DirectoryConnection[];
  now: number;
  onClose: () => void;
  onOpenErrors: (event: DirectoryEvent) => void;
}) {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const nameOf = useConnectionNames(connections);
  const changed = useChanged();
  const about = useAbout();
  const failed = !!event && event.status !== "success";

  return (
    <Drawer open={open && !!event} onOpenChange={(next) => !next && onClose()}>
      {event ? (
        <DrawerContent
          size="sm"
          title={t(runKey(event))}
          description={t("sync.drawer.description", {
            connection: nameOf(event.connection_id),
            date: formatDateTime(event.started_at, locale),
          })}
        >
          <DrawerBody>
            <div className="sync-drawer">
              <DescriptionList>
                <DescriptionItem term={t("sync.drawer.result")}>
                  <Badge tone={RESULT_TONE[event.status]} size="sm">
                    {t(`sync.results.${event.status}`)}
                  </Badge>
                </DescriptionItem>
                {failed ? (
                  <DescriptionItem term={t("sync.drawer.cause")}>
                    {t(`errors.causes.${causeOf(event)}.name`)}
                  </DescriptionItem>
                ) : null}
                <DescriptionItem term={t("sync.drawer.startedBy")}>
                  {event.retry_of
                    ? t("activity.drawer.retryOf")
                    : t(`sync.triggers.${event.trigger}`)}
                </DescriptionItem>
                <DescriptionItem term={t("sync.drawer.affects")}>
                  {event.resource_type === "user" &&
                  event.resource_id &&
                  event.operation !== "delete" ? (
                    <Link
                      render={
                        <RouterLink to="/users/$userId" params={{ userId: event.resource_id }} />
                      }
                    >
                      {about(event)}
                    </Link>
                  ) : (
                    about(event)
                  )}
                </DescriptionItem>
                <DescriptionItem term={t("sync.drawer.changed")}>{changed(event)}</DescriptionItem>
                <DescriptionItem term={t("sync.drawer.took")}>
                  {formatDirectoryDuration(event.duration_ms)}
                </DescriptionItem>
                {failed ? (
                  <DescriptionItem term={t("activity.drawer.failure")}>
                    {event.resolution === "open"
                      ? t("activity.drawer.failureOpen")
                      : event.resolved_at
                        ? event.resolution === "retried"
                          ? t("sync.drawer.retried", {
                              when: whenText(event.resolved_at, now),
                            })
                          : t("sync.drawer.resolved", {
                              when: whenText(event.resolved_at, now),
                            })
                        : t(`sync.resolutions.${event.resolution}`)}
                  </DescriptionItem>
                ) : null}
              </DescriptionList>
              {failed ? (
                <Text size="sm" tone="subtle" className="sync-tech">
                  {t("sync.technical")}{" "}
                  <code>
                    {[event.error_code, `HTTP ${event.http_status}`, event.message]
                      .filter(Boolean)
                      .join(" · ")}
                  </code>
                </Text>
              ) : null}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {t("sync.drawer.close")}
            </Button>
            {failed ? (
              <Button icon={ArrowRightIcon} onClick={() => onOpenErrors(event)}>
                {t("activity.actions.openErrors")}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
