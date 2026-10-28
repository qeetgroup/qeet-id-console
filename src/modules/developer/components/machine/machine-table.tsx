import {
  CopyIcon,
  PauseIcon,
  PlayIcon,
  PowerOffIcon,
  RefreshCwIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { MenuItem, MenuSeparator, type TableColumn } from "@qeetrix/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { User } from "@/modules/users";
import { isLive, type Machine } from "@/modules/developer/machine-model";
import { CredBadge, NameCell, Owner, Scopes, When } from "../parts";
import type { MachineTab } from "./machine-tabs";

const minutes = (seconds: number) => Math.round(seconds / 60);

/**
 * The tab's columns: the credential (its name over the identifier people match it by), what it
 * can do, who it belongs to or answers to, the dates its kind has, and its status. Lean: one fact a
 * column, two lines at most.
 */
export function useMachineColumns(
  tab: MachineTab,
  now: number,
  people: ReadonlyMap<string, User>,
): TableColumn<Machine>[] {
  const { t } = useTranslation("developer");
  const name: TableColumn<Machine> = {
    id: "name",
    header: t("machine.columns.name"),
    primary: true,
    sortable: true,
    cell: (m) => <NameCell name={m.name} ident={m.ident} shorten={m.kind !== "key"} />,
  };
  const scopes: TableColumn<Machine> = {
    id: "scopes",
    header: t("machine.columns.scopes"),
    cell: (m) => <Scopes scopes={m.scopes} max={tab === "all" ? 1 : 2} />,
  };
  const status: TableColumn<Machine> = {
    id: "status",
    header: t("machine.columns.status"),
    width: 128,
    cell: (m) => <CredBadge status={m.status} />,
  };
  const created: TableColumn<Machine> = {
    id: "created",
    header: t("machine.columns.created"),
    sortable: true,
    sortFirst: "descending",
    width: 140,
    cell: (m) => <When at={m.createdAt} now={now} />,
  };
  const owner = (header: string): TableColumn<Machine> => ({
    id: "owner",
    header,
    cell: (m) => <Owner id={m.personId} people={people} />,
  });
  const used: TableColumn<Machine> = {
    id: "used",
    header: t("machine.columns.used"),
    sortable: true,
    sortFirst: "descending",
    width: 140,
    cell: (m) =>
      m.kind === "key" ? (
        <When at={m.lastUsedAt} now={now} none={t("machine.row.neverUsed")} />
      ) : (
        // The server records no last use for identities or agents (a gap filed for QTID).
        <span className="dev-subtle" title={t("machine.row.notRecorded")}>
          —
        </span>
      ),
  };
  const expires: TableColumn<Machine> = {
    id: "expires",
    header: t("machine.columns.expires"),
    sortable: true,
    width: 132,
    cell: (m) => <When at={m.expiresAt} now={now} none={t("machine.row.never")} />,
  };

  if (tab === "all")
    return [
      name,
      {
        id: "kind",
        header: t("machine.columns.kind"),
        sortable: true,
        width: 150,
        cell: (m) => <span className="dev-nowrap">{t(`machine.kind.${m.kind}`)}</span>,
      },
      scopes,
      owner(t("machine.columns.owner")),
      used,
      expires,
      status,
    ];
  if (tab === "key")
    return [name, scopes, owner(t("machine.columns.owner")), used, expires, status];
  if (tab === "identity") return [name, scopes, created, status];
  return [
    name,
    scopes,
    owner(t("machine.columns.sponsor")),
    {
      id: "ttl",
      header: t("machine.columns.ttl"),
      width: 120,
      cell: (m) => t("machine.row.minutes", { count: minutes(m.ttl ?? 600) }),
    },
    created,
    status,
  ];
}

export type MachineActions = {
  replace: (m: Machine) => void;
  revoke: (m: Machine) => void;
  disable: (m: Machine) => void;
  suspend: (m: Machine) => void;
  resume: (m: Machine) => void;
  remove: (m: Machine) => void;
};

/** A credential's actions, by its kind and status. Copying its identifier is always there. */
export function MachineRowActions({
  machine: m,
  actions,
}: {
  machine: Machine;
  actions: MachineActions;
}) {
  const { t } = useTranslation("developer");
  const copy = () =>
    void navigator.clipboard
      .writeText(m.ident)
      .then(() => toast.success(t("machine.actions.copied")))
      .catch(() => toast.error(t("machine.actions.copyFailed")));
  const copyItem = (
    <MenuItem icon={CopyIcon} onClick={copy}>
      {t(`machine.actions.copy.${m.kind}`)}
    </MenuItem>
  );
  if (m.kind === "key")
    return (
      <>
        {isLive(m) ? (
          <MenuItem
            icon={RefreshCwIcon}
            description={t("machine.actions.replaceHint")}
            onClick={() => actions.replace(m)}
          >
            {t("machine.actions.replace")}
          </MenuItem>
        ) : null}
        {copyItem}
        {m.status !== "revoked" ? (
          <>
            <MenuSeparator />
            <MenuItem icon={TrashIcon} tone="danger" onClick={() => actions.revoke(m)}>
              {t("machine.actions.revoke")}
            </MenuItem>
          </>
        ) : null}
      </>
    );
  if (m.kind === "identity")
    return (
      <>
        {copyItem}
        {m.status === "active" ? (
          <>
            <MenuSeparator />
            <MenuItem icon={PowerOffIcon} tone="danger" onClick={() => actions.disable(m)}>
              {t("machine.actions.disable")}
            </MenuItem>
          </>
        ) : null}
      </>
    );
  return (
    <>
      {m.status === "suspended" ? (
        <MenuItem icon={PlayIcon} onClick={() => actions.resume(m)}>
          {t("machine.actions.resume")}
        </MenuItem>
      ) : (
        <MenuItem icon={PauseIcon} onClick={() => actions.suspend(m)}>
          {t("machine.actions.suspend")}
        </MenuItem>
      )}
      {copyItem}
      <MenuSeparator />
      <MenuItem icon={TrashIcon} tone="danger" onClick={() => actions.remove(m)}>
        {t("machine.actions.delete")}
      </MenuItem>
    </>
  );
}
