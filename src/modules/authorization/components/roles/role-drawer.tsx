import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  formatDate,
  Heading,
  Link,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { Alert, AvatarItem } from "@qeetrix/react/experimental";
import { Link as RouterLink, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SplitBar } from "@/modules/dashboard";
import { useRegisterContext } from "@/modules/qeetai";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type Capability, CONSOLE_CAPABILITIES } from "@/platform/security/capability-model";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import type { Role } from "@/modules/authorization/api/rbac";
import type { RoleAccessView } from "@/modules/authorization/api/role-access";
import { useSaveRolePermissions } from "@/modules/authorization/api/role-save";
import {
  actionsOf,
  isOwnerRole,
  type ResourcePermissions,
  type RoleAccess,
  resourcesOf,
} from "@/modules/authorization/role-model";
import { personLabel, ResourceName, useActionName, useCount } from "../lists/authz-parts";

const SHOW_PEOPLE = 6;
const isCapability = (key: string): key is Capability =>
  (CONSOLE_CAPABILITIES as readonly string[]).includes(key);

/**
 * A role, as Roles and Models › RBAC both open it: who holds it and through what, then its
 * permissions by resource, read and write side by side. Changes are staged and saved together,
 * behind one step-up; the owner role's permissions are fixed (the server refuses any change), and
 * a person can only give or take away permissions they hold themselves (rbac.CheckGrantPermission).
 */
export function RoleDrawer({
  roleId,
  view,
  onClose,
}: {
  /** The open role; null closes the drawer. */
  roleId: string | null;
  view: RoleAccessView;
  onClose: () => void;
}) {
  const access = roleId ? view.access.find((a) => a.role.id === roleId) : undefined;
  return (
    <Drawer open={!!access} onOpenChange={(open) => !open && onClose()}>
      {access ? <RoleDrawerContent key={access.role.id} access={access} view={view} /> : null}
    </Drawer>
  );
}

function RoleDrawerContent({ access, view }: { access: RoleAccess; view: RoleAccessView }) {
  const { t } = useTranslation(["authorization", "common"]);
  const n = useCount();
  const locale = formatLocale();
  const { role } = access;
  const caps = useCapabilities();
  const runSensitive = useSensitiveAction();
  const saveM = useSaveRolePermissions(role.id);

  // Tells Qeet AI which role is open, so "Grant permission to this role" is prefilled.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const selection = useMemo(
    () => ({ selection: { kind: "role" as const, id: role.id, label: role.name } }),
    [role.id, role.name],
  );
  useRegisterContext(pathname, selection);

  const owner = isOwnerRole(role);
  const canWrite = caps.can("role.write");
  const editable = canWrite && !owner;
  const holds = (key: string) => isCapability(key) && caps.can(key);

  const resources = useMemo(() => resourcesOf(view.catalogue), [view.catalogue]);
  const current = access.permissions;
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  // A save refreshes the role: start again from what it grants now.
  const granted = current ? [...current].sort().join(" ") : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when what it grants changes
  useEffect(() => setDraft(null), [granted]);
  const chosen = draft ?? current ?? new Set<string>();
  const gain = [...chosen].filter((k) => !current?.has(k));
  const lose = [...(current ?? [])].filter((k) => !chosen.has(k));
  const changed = gain.length + lose.length > 0;
  const toggle = (key: string, on: boolean) => {
    const next = new Set(chosen);
    on ? next.add(key) : next.delete(key);
    setDraft(next);
  };

  const note = owner
    ? t("lists.drawer.permissions.owner")
    : !canWrite
      ? t("lists.drawer.permissions.readOnly")
      : resources.some((r) => [...r.actions.values()].some((p) => !holds(p.key)))
        ? t("lists.drawer.permissions.notHeld")
        : null;

  const idOf = (key: string) => view.catalogue.find((p) => p.key === key)?.id;
  const save = () => {
    setFailure(null);
    runSensitive({
      actionLabel: t("lists.drawer.saveAction"),
      run: () =>
        saveM.mutateAsync({
          grant: gain.map(idOf).filter((id): id is string => !!id),
          revoke: lose.map(idOf).filter((id): id is string => !!id),
        }),
    }).catch((err: unknown) => {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(err);
      settleSensitiveAction(err);
    });
  };

  return (
    <DrawerContent title={role.name} description={role.description || undefined} size="md">
      <DrawerBody>
        <div className="ppl authz-drawer">
          <p className="authz-drawer-kind">
            {role.is_system ? <Badge size="sm">{t("lists.common.builtIn")}</Badge> : null}
            <Text size="sm" tone="subtle">
              {t(role.is_system ? "lists.drawer.builtIn" : "lists.drawer.custom", {
                date: formatDate(role.created_at, locale, { dateStyle: "medium" }),
              })}
            </Text>
          </p>

          <Holders access={access} view={view} />

          <DrawerSection
            title={t("lists.drawer.permissions.title")}
            count={
              current
                ? t("lists.drawer.permissions.count", {
                    n: n(chosen.size),
                    total: n(view.catalogue.length),
                  })
                : undefined
            }
          >
            <PermissionGrid
              role={role}
              resources={resources}
              chosen={chosen}
              loading={!current}
              disabled={(key) => !editable || !holds(key)}
              onToggle={toggle}
            />
            {note ? (
              <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
                {note}
              </Text>
            ) : null}
            {editable && changed ? (
              <Text size="sm" weight="medium" render={<p className="authz-drawer-note" />}>
                {access.holders.size
                  ? t("lists.drawer.permissions.effect", {
                      count: access.holders.size,
                      n: n(access.holders.size),
                    })
                  : t("lists.drawer.permissions.effectNone")}
              </Text>
            ) : null}
          </DrawerSection>

          {failure ? (
            <Alert tone="danger" title={t("lists.drawer.saveFailed")}>
              {errorMessage(failure)}
              <ErrorReference error={failure} />
            </Alert>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter>
        {editable ? (
          <>
            {changed ? (
              <Text size="sm" tone="subtle" className="authz-footer-note">
                {t("lists.drawer.permissions.pending", {
                  gain: n(gain.length),
                  lose: n(lose.length),
                })}
              </Text>
            ) : null}
            <DrawerClose render={<Button variant="ghost">{t("common:actions.cancel")}</Button>} />
            <Button disabled={!changed || saveM.isPending} onClick={save}>
              {t("lists.drawer.save")}
            </Button>
          </>
        ) : (
          <DrawerClose render={<Button variant="ghost">{t("lists.common.close")}</Button>} />
        )}
      </DrawerFooter>
    </DrawerContent>
  );
}

/** A titled part of the drawer, ruled above, with its count at the end of its title. */
function DrawerSection({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="authz-drawer-section" aria-labelledby={id}>
      <div className="authz-drawer-head">
        <Heading level={3} size="title-sm" id={id}>
          {title}
        </Heading>
        {count ? (
          <Text size="sm" tone="subtle">
            {count}
          </Text>
        ) : null}
      </div>
      {note ? (
        <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
          {note}
        </Text>
      ) : null}
      {children}
    </section>
  );
}

/** Who holds the role: people it's given to, and the groups whose members it reaches. */
function Holders({ access, view }: { access: RoleAccess; view: RoleAccessView }) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const total = access.holders.size;
  const direct = [...access.direct]
    .map((id) => ({
      id,
      name: personLabel(view.peopleById.get(id), id),
      user: view.peopleById.get(id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groupsOnly = access.throughGroupsOnly;
  const everyone = view.people?.length ?? 0;

  if (!view.peopleKnown) {
    return (
      <DrawerSection title={t("lists.drawer.holders.title")}>
        <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
          {t("lists.drawer.holders.cantSeePeople")}
        </Text>
      </DrawerSection>
    );
  }
  return (
    <DrawerSection
      title={t("lists.drawer.holders.title")}
      count={t("lists.drawer.holders.total", { count: total, n: n(total) })}
    >
      {total === 0 ? (
        <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
          {t("lists.drawer.holders.nobody")}
        </Text>
      ) : (
        <div className="authz-holders-split">
          <SplitBar
            label={t("lists.drawer.holders.shareLabel", {
              n: n(total),
              total: n(everyone),
              direct: n(access.direct.length),
              groups: n(groupsOnly),
            })}
            parts={[
              { value: access.direct.length, color: "var(--ppl-today)" },
              { value: groupsOnly, color: "var(--ppl-month)" },
              { value: Math.max(0, everyone - total), color: "var(--ppl-never)" },
            ]}
          />
          <Text size="sm" tone="subtle" aria-hidden="true">
            {view.groupsKnown && groupsOnly > 0
              ? t("lists.drawer.holders.shareSplit", {
                  n: n(total),
                  total: n(everyone),
                  direct: n(access.direct.length),
                  groups: n(groupsOnly),
                })
              : t("lists.drawer.holders.share", { n: n(total), total: n(everyone) })}
          </Text>
        </div>
      )}

      <div className="authz-holder-block">
        <div className="authz-holder-head">
          <Text weight="medium">{t("lists.drawer.holders.directly")}</Text>
          <Text size="sm" tone="subtle">
            {n(access.direct.length)}
          </Text>
        </div>
        <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
          {t("lists.drawer.holders.directlyNote")}
        </Text>
        {direct.length ? (
          <ul className="authz-holder-list">
            {direct.slice(0, SHOW_PEOPLE).map((p) => (
              <li key={p.id}>
                <AvatarItem
                  name={p.name}
                  description={p.user && p.user.email !== p.name ? p.user.email : undefined}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        ) : null}
        {direct.length ? (
          <Link render={<RouterLink to="/users" search={{ role: access.role.name }} />}>
            {direct.length > SHOW_PEOPLE
              ? `${t("lists.drawer.holders.seeAll")} (${n(direct.length)})`
              : t("lists.drawer.holders.seeAll")}
          </Link>
        ) : null}
      </div>

      <div className="authz-holder-block">
        <div className="authz-holder-head">
          <Text weight="medium">{t("lists.drawer.holders.throughGroups")}</Text>
          {view.groupsKnown ? (
            <Text size="sm" tone="subtle">
              {n(access.groups.length)}
            </Text>
          ) : null}
        </div>
        <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
          {view.groupsKnown
            ? access.groups.length
              ? t("lists.drawer.holders.throughGroupsNote")
              : t("lists.drawer.holders.noGroups")
            : t("lists.drawer.holders.cantSeeGroups")}
        </Text>
        {access.groups.length ? (
          <ul className="authz-holder-list">
            {access.groups.map((g) => (
              <li key={g.id} className="authz-holder-group">
                <Link render={<RouterLink to="/groups/$groupId" params={{ groupId: g.id }} />}>
                  {g.name}
                </Link>
                <Text size="sm" tone="subtle">
                  {g.members
                    ? g.members.length
                      ? t("lists.common.members", {
                          count: g.members.length,
                          n: n(g.members.length),
                        })
                      : t("lists.common.noOne")
                    : null}
                </Text>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DrawerSection>
  );
}

/** The role's permissions: a row per resource, a column per action, a box per permission. */
function PermissionGrid({
  role,
  resources,
  chosen,
  loading,
  disabled,
  onToggle,
}: {
  role: Role;
  resources: ResourcePermissions[];
  chosen: ReadonlySet<string>;
  loading: boolean;
  disabled: (key: string) => boolean;
  onToggle: (key: string, on: boolean) => void;
}) {
  const { t } = useTranslation("authorization");
  const actionName = useActionName();
  const actions = actionsOf(resources);
  const columns: TableColumn<ResourcePermissions>[] = [
    {
      id: "resource",
      header: t("lists.drawer.permissions.resource"),
      cell: (r) => <ResourceName resource={r.key} />,
    },
    ...actions.map(
      (action): TableColumn<ResourcePermissions> => ({
        id: action,
        header: actionName(action),
        align: "center",
        width: 88,
        cell: (r) => {
          const p = r.actions.get(action);
          if (!p) {
            return (
              <span className="authz-none" title={t("lists.drawer.permissions.noSuch")}>
                —
              </span>
            );
          }
          return (
            <span className="authz-check" title={p.description || undefined}>
              <Checkbox
                aria-label={p.description ? `${p.key}: ${p.description}` : p.key}
                checked={chosen.has(p.key)}
                disabled={disabled(p.key)}
                onCheckedChange={(on) => onToggle(p.key, on)}
              />
            </span>
          );
        },
      }),
    ),
  ];
  return (
    <Table<ResourcePermissions>
      label={t("lists.drawer.permissions.tableLabel", { role: role.name })}
      className="authz-grid"
      rows={loading ? [] : resources}
      rowId={(r) => r.key}
      rowLabel={(r) => r.key}
      columns={columns}
      loading={loading}
      loadingRows={6}
    />
  );
}
