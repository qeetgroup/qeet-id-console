import {
  ArrowRightIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  PlugIcon,
  PowerIcon,
  RefreshCwIcon,
  ServerIcon,
  TrashIcon,
  WorkflowIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  MenuItem,
  MenuSeparator,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryEvent } from "@/modules/directory/api/directory";
import { healthState, problemText } from "@/modules/directory/connections-model";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { getApiBaseUrl } from "@/platform/api/client";
import { HEALTH_ICONS } from "./connections-band";

/** A connection's own page: SCIM's, or the LDAP connection's (`/ldap/$id`). */
export const connectionPage = (c: Pick<DirectoryConnection, "type" | "id">) =>
  c.type === "scim"
    ? ({ to: "/directory/connections/scim" } as const)
    : ({ to: "/directory/connections/ldap/$id", params: { id: c.id } } as const);

/**
 * The list's columns: the connection (its kind, its name over its address), its kind in a word, its
 * people, whether it's on, its health with the latest open problem, and when it was last used (the
 * SCIM token's last request; an LDAP connection's last sign-in).
 */
export function useConnectionColumns({
  problems,
  now,
}: {
  problems: ReadonlyMap<string, DirectoryEvent>;
  now: number;
}): TableColumn<DirectoryConnection>[] {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const ago = (iso: string) => formatRelativeTime(Date.parse(iso), locale, now);

  return [
    {
      id: "name",
      header: t("connections.columns.connection"),
      primary: true,
      cell: (c) => {
        const Icon = c.type === "scim" ? WorkflowIcon : ServerIcon;
        return (
          <span className="dir-cell">
            <span className="dir-kind" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="dir-two">
              <Link className="dir-name" {...connectionPage(c)}>
                {c.type === "scim" ? t("connections.kinds.scim") : c.name}
              </Link>
              <small>
                <code>{c.type === "scim" ? `${getApiBaseUrl()}/scim/v2` : c.serverUrl}</code>
              </small>
            </span>
          </span>
        );
      },
    },
    {
      id: "kind",
      header: t("connections.columns.kind"),
      width: 120,
      cell: (c) => (c.type === "scim" ? t("connections.kind.scim") : t("connections.kind.ldap")),
    },
    {
      id: "people",
      header: t("connections.columns.people"),
      numeric: true,
      width: 100,
      cell: (c) =>
        c.userCount === null ? (
          <Text tone="subtle" title={t("connections.notCounted")}>
            —
          </Text>
        ) : (
          n(c.userCount)
        ),
    },
    {
      id: "status",
      header: t("connections.columns.status"),
      width: 100,
      cell: (c) =>
        c.status === "draft" ? (
          <Badge tone="neutral" size="sm">
            {t("connections.status.draft")}
          </Badge>
        ) : c.status === "disabled" ? (
          <Badge tone="neutral" size="sm">
            {t("connections.status.off")}
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            {t("connections.status.on")}
          </Badge>
        ),
    },
    {
      id: "health",
      header: t("connections.columns.health"),
      width: 230,
      cell: (c) => {
        const state = healthState(c);
        const Icon = HEALTH_ICONS[state];
        const problem = problems.get(c.id);
        return (
          <span className={`dir-status is-${state}`}>
            <Icon size={16} aria-hidden="true" />
            <span className="dir-two">
              <span>{t(`connections.health.${state}`)}</span>
              {problem ? (
                <small title={problem.message}>
                  {t("connections.problem", {
                    what: problemText(problem),
                    when: ago(problem.started_at),
                  })}
                </small>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      id: "used",
      header: t("connections.columns.used"),
      width: 130,
      cell: (c) =>
        c.lastActivityAt ? (
          <time dateTime={c.lastActivityAt} title={formatDateTime(c.lastActivityAt, locale)}>
            {ago(c.lastActivityAt)}
          </time>
        ) : (
          <Text tone="subtle">{t("connections.never")}</Text>
        ),
    },
  ];
}

/** A row's menu: open it; for LDAP test, turn on or off, delete; for SCIM rotate and revoke. */
export function ConnectionRowMenu({
  connection: c,
  canWrite,
  onTest,
  onSetOn,
  onDelete,
  onRevoke,
}: {
  connection: DirectoryConnection;
  canWrite: boolean;
  onTest: (c: DirectoryConnection) => void;
  onSetOn: (c: DirectoryConnection, on: boolean) => void;
  onDelete: (c: DirectoryConnection) => void;
  onRevoke: (c: DirectoryConnection) => void;
}) {
  const { t } = useTranslation("directory");
  const navigate = useNavigate();
  const open = () => void navigate(connectionPage(c));
  if (c.type === "scim")
    return (
      <>
        <MenuItem icon={ArrowRightIcon} onClick={open}>
          {t("connections.actions.open")}
        </MenuItem>
        {canWrite ? (
          <>
            {/* Rotating shows the new token once, on the SCIM page. */}
            <MenuItem icon={RefreshCwIcon} onClick={open}>
              {t("connections.actions.rotate")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={KeyRoundIcon} tone="danger" onClick={() => onRevoke(c)}>
              {t("connections.actions.revoke")}
            </MenuItem>
          </>
        ) : null}
      </>
    );
  return (
    <>
      <MenuItem icon={ArrowRightIcon} onClick={open}>
        {t("connections.actions.open")}
      </MenuItem>
      {canWrite ? (
        <>
          <MenuItem icon={FlaskConicalIcon} onClick={() => onTest(c)}>
            {t("connections.actions.test")}
          </MenuItem>
          <MenuItem icon={PowerIcon} onClick={() => onSetOn(c, c.status !== "active")}>
            {c.status === "active"
              ? t("connections.actions.turnOff")
              : t("connections.actions.turnOn")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={TrashIcon} tone="danger" onClick={() => onDelete(c)}>
            {t("connections.actions.delete", { name: c.name })}
          </MenuItem>
        </>
      ) : null}
    </>
  );
}

/** The kinds not set up yet, under the table: what each does, and how to start. */
export function ConnectionOffers({
  kinds,
  canWrite,
}: {
  kinds: ("scim" | "ldap")[];
  canWrite: boolean;
}) {
  const { t } = useTranslation("directory");
  if (!kinds.length) return null;
  return (
    <section className="dir-offers" aria-label={t("connections.offers.label")}>
      {kinds.map((kind) => {
        const Icon = kind === "scim" ? WorkflowIcon : ServerIcon;
        return (
          <div key={kind} className="dir-offer">
            <span className="dir-kind" aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="dir-offer-text">
              <p className="dir-offer-title">
                {t(`connections.offers.${kind}.title`)}
                <Badge size="sm">{t("connections.offers.notSetUp")}</Badge>
              </p>
              <p className="dir-offer-body">{t(`connections.offers.${kind}.body`)}</p>
            </div>
            {canWrite ? (
              <Button
                variant="soft"
                tone="neutral"
                size="sm"
                icon={PlugIcon}
                render={
                  kind === "scim" ? (
                    <Link to="/directory/connections/scim" />
                  ) : (
                    <Link to="/directory/connections/ldap" search={{ action: "create" }} />
                  )
                }
              >
                {t(`connections.offers.${kind}.action`)}
              </Button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
