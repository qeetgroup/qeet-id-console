import { RefreshCwIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  formatDateTime,
  Heading,
  Text,
} from "@qeetrix/react";
import { DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import {
  type DirectoryConnection,
  formatDirectoryDuration,
} from "@/modules/directory/directory-model";
import { causeOf, portOf, runKey } from "@/modules/directory/sync-model";
import { Affects, RESOLUTION_TONE, SEVERITY_BADGE } from "./errors-table";
import { FixSteps, TechnicalLine } from "./errors-problems";
import { useConnectionNames, whenText } from "./sync-parts";

/**
 * One failure, opened from its row: where it stands and how bad it is, how to fix its cause, the
 * facts (the run, who started it, who it reached, the code, how long it took), and the server's own
 * words. An open one can be marked resolved, and a connection check checked again; anything else
 * can only be sent again from its source, which the drawer says.
 */
export function ErrorDrawer({
  open,
  event,
  connections,
  canWrite,
  pending,
  now,
  onClose,
  onCheckAgain,
  onResolve,
}: {
  open: boolean;
  /** The failure on show; it stays while the drawer closes. */
  event: DirectoryEvent | null;
  connections: readonly DirectoryConnection[];
  canWrite: boolean;
  pending: boolean;
  now: number;
  onClose: () => void;
  onCheckAgain: (events: readonly DirectoryEvent[]) => void;
  onResolve: (events: readonly DirectoryEvent[]) => void;
}) {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const nameOf = useConnectionNames(connections);
  const connection = event ? connections.find((c) => c.id === event.connection_id) : undefined;
  const isOpen = event?.resolution === "open";
  const severity = event?.severity === "critical" ? "critical" : "warning";

  return (
    <Drawer open={open && !!event} onOpenChange={(next) => !next && onClose()}>
      {event ? (
        <DrawerContent
          size="md"
          title={t(`errors.causes.${causeOf(event)}.name`)}
          description={t("errors.drawer.description", {
            connection: nameOf(event.connection_id),
            date: formatDateTime(event.started_at, locale),
          })}
        >
          <DrawerBody>
            <div className="sync-drawer">
              <DescriptionList>
                <DescriptionItem term={t("errors.drawer.status")}>
                  <Badge size="sm" tone={RESOLUTION_TONE[event.resolution]}>
                    {t(`sync.resolutions.${event.resolution}`)}
                  </Badge>
                  {event.resolved_at ? (
                    <Text size="sm" tone="subtle">
                      {event.resolution === "retried"
                        ? t("errors.drawer.closedRetried", {
                            when: whenText(event.resolved_at, now),
                          })
                        : t("errors.drawer.closedResolved", {
                            when: whenText(event.resolved_at, now),
                          })}
                    </Text>
                  ) : null}
                </DescriptionItem>
                <DescriptionItem term={t("errors.drawer.severity")}>
                  <Badge size="sm" {...SEVERITY_BADGE[severity]}>
                    {t(`sync.severities.${severity}`)}
                  </Badge>
                </DescriptionItem>
                <DescriptionItem term={t("errors.drawer.run")}>{t(runKey(event))}</DescriptionItem>
                <DescriptionItem term={t("errors.drawer.startedBy")}>
                  {t(`sync.triggers.${event.trigger}`)}
                </DescriptionItem>
                <DescriptionItem term={t("errors.drawer.affects")}>
                  <Affects event={event} />
                </DescriptionItem>
                <DescriptionItem term={t("errors.drawer.code")}>
                  <code className="sync-code">
                    {event.error_code} · HTTP {event.http_status}
                  </code>
                </DescriptionItem>
                <DescriptionItem term={t("errors.drawer.took")}>
                  {formatDirectoryDuration(event.duration_ms)}
                </DescriptionItem>
              </DescriptionList>
              {isOpen ? (
                <section className="sync-drawer-fix">
                  <Heading level={3} size="title-sm">
                    {t("errors.problem.fixTitle")}
                  </Heading>
                  <FixSteps
                    cause={causeOf(event)}
                    server={connection?.serverUrl ?? t("errors.problem.itsAddress")}
                    port={portOf(connection?.serverUrl ?? null)}
                  />
                  {!event.retryable ? (
                    <Text size="sm" tone="subtle">
                      {t("errors.drawer.retryElsewhere")}
                    </Text>
                  ) : null}
                </section>
              ) : null}
              <TechnicalLine event={event} />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="ghost" onClick={onClose}>
              {t("errors.drawer.close")}
            </Button>
            {canWrite && isOpen ? (
              <Button
                variant={event.retryable ? "ghost" : "soft"}
                disabled={pending}
                onClick={() => onResolve([event])}
              >
                {t("errors.problem.markResolved")}
              </Button>
            ) : null}
            {canWrite && isOpen && event.retryable ? (
              <Button
                variant="soft"
                icon={RefreshCwIcon}
                loading={pending}
                onClick={() => onCheckAgain([event])}
              >
                {t("errors.problem.checkAgain")}
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
