import { LayoutTemplateIcon, PlusIcon, SearchIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  formatNumber,
  Link,
  Select,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert, Combobox } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { useRoles } from "@/modules/authorization";
import {
  type Group,
  useAddGroupMember,
  useAssignGroupRole,
  useCreateGroup,
  useUpdateGroup,
} from "@/modules/groups/api/groups";
import { everyGroup, groupTree } from "@/modules/groups/groups-model";
import { useOrgs } from "@/modules/organizations";
import { useTenantId } from "@/platform/auth/session";
import { ErrorReference } from "@/platform/components/error-reference";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

const TOP = "__top__";
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type GroupPerson = { id: string; email: string; display_name?: string | null };

export type GroupDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every group: for the name check and "Inside". */
  groups: readonly Group[];
  /** People to choose members from; without them (no user.read) there's no Members field. */
  people?: readonly GroupPerson[];
  /** Edit this group; without it, the drawer makes a new one. */
  group?: Group | null;
  /** Make the new group inside this one ("Add a group inside"). */
  parentId?: string;
  /** "Use a template", at the footer's start; the page opens its templates. */
  onUseTemplate?: () => void;
};

/**
 * New group, and Edit group: one drawer. The name is checked as it's typed (names are unique in an
 * organisation, ignoring case); "Inside" searches every group by its path; members are searched and
 * kept as pills; the role says who gets it: the group's own members, not the groups inside it (the
 * server's rule). A new group's members and role are calls after it's made; granting the role asks
 * the person to confirm it's them.
 */
export function GroupDrawer({
  open,
  onOpenChange,
  groups,
  people,
  group,
  parentId,
  onUseTemplate,
}: GroupDrawerProps) {
  const { t } = useTranslation("groups");
  const access = useCapabilities();
  const canGrant = access.can("role.read") && access.can("role.write");
  const tenantId = useTenantId();
  const org = useOrgs().data?.items.find((item) => item.id === tenantId);
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const runSensitive = useSensitiveAction();
  const createM = useCreateGroup();
  const updateM = useUpdateGroup();
  const addMemberM = useAddGroupMember({ silent: true });
  const assignRoleM = useAssignGroupRole();
  const roles = (useRoles().data?.items ?? []).filter((r) => r.name !== "owner");

  const editing = group ?? undefined;
  const [name, setName] = useState("");
  const [inside, setInside] = useState(TOP);
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [roleId, setRoleId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; inside?: string; form?: string }>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [running, setRunning] = useState(false);

  // Each time it opens: the group being edited, or a new one (inside `parentId`).
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setInside(editing ? (editing.parent_id ?? TOP) : (parentId ?? TOP));
    setDescription(editing?.description ?? "");
    setMembers([]);
    setRoleId("");
    setErrors({});
    setFailure(null);
  }, [open, editing, parentId]);

  const all = useMemo(() => everyGroup(groupTree(groups)), [groups]);
  const byId = useMemo(() => new Map(all.map((g) => [g.id, g])), [all]);
  const pathOf = (id: string) => {
    const g = byId.get(id);
    return g ? [...g.path, g.name] : [];
  };
  // Editing: not itself, nor a group inside it (the server refuses a loop).
  const blocked = useMemo(() => {
    const own = editing ? byId.get(editing.id) : undefined;
    return new Set(own ? everyGroup([own]).map((g) => g.id) : []);
  }, [editing, byId]);
  const places = [
    { value: TOP, label: t("drawer.atTheTop"), description: t("drawer.atTheTopHint") },
    ...all
      .filter((g) => !blocked.has(g.id))
      .map((g) => ({
        value: g.id,
        label: [...g.path, g.name].join(" › "),
        description: g.children.length
          ? t("drawer.placeWithGroups", {
              count: g.member_count,
              n: n(g.member_count),
              inside: n(g.inside),
            })
          : t("drawer.place", { count: g.member_count, n: n(g.member_count) }),
      })),
  ];
  const clash = name.trim()
    ? all.find((g) => g.id !== editing?.id && same(g.name, name))
    : undefined;
  const clashText = clash
    ? clash.path.length
      ? t("drawer.nameTakenIn", { name: clash.name, path: clash.path.join(" › ") })
      : t("drawer.nameTaken", { name: clash.name })
    : undefined;
  const where = [...(inside === TOP ? [] : pathOf(inside)), name.trim() || t("drawer.newOne")];
  const own = editing ? byId.get(editing.id) : undefined;
  const moving = !!editing && (editing.parent_id ?? TOP) !== inside;
  const role = roles.find((r) => r.id === roleId);
  const busy = running || createM.isPending || updateM.isPending;

  const fail = (err: unknown) => {
    const code = normalizeError(err).code;
    if (code === ERROR_CODES.GROUP_NAME_EXISTS) setErrors({ name: t("drawer.nameTakenServer") });
    else if (code === ERROR_CODES.GROUP_CYCLE) setErrors({ inside: t("drawer.cycle") });
    else {
      setFailure(err);
      setErrors({ form: errorMessage(err) });
    }
  };

  async function submit() {
    if (!name.trim()) return setErrors({ name: t("drawer.nameRequired") });
    if (clash) return;
    setErrors({});
    setFailure(null);
    const body = {
      name: name.trim(),
      description: description.trim(),
      parent_id: inside === TOP ? null : inside,
    };
    if (editing) {
      try {
        await updateM.mutateAsync({ groupId: editing.id, body });
        onOpenChange(false);
      } catch (err) {
        fail(err);
      }
      return;
    }
    setRunning(true);
    try {
      const made = await createM.mutateAsync({
        ...body,
        description: body.description || undefined,
      });
      // Members and the role are calls after the group exists: the create endpoint takes neither.
      await Promise.allSettled([
        ...members.map((userId) => addMemberM.mutateAsync({ groupId: made.id, userId })),
        ...(roleId
          ? [
              runSensitive({
                actionLabel: t("drawer.roleAction"),
                run: () => assignRoleM.mutateAsync({ groupId: made.id, roleId }),
              }).catch(settleSensitiveAction),
            ]
          : []),
      ]);
      onOpenChange(false);
    } catch (err) {
      fail(err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => (!busy || next) && onOpenChange(next)}>
      <DrawerContent
        title={editing ? t("drawer.editTitle", { name: editing.name }) : t("drawer.title")}
        description={editing ? t("drawer.editDescription") : t("drawer.description")}
        size="md"
      >
        <DrawerBody>
          <form
            id="group-drawer"
            className="sub-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void submit();
            }}
          >
            {errors.form ? <Alert tone="danger" title={errors.form} /> : null}
            {failure ? <ErrorReference error={failure} /> : null}
            <TextField
              label={t("drawer.name")}
              value={name}
              onValueChange={(value) => {
                setName(value);
                if (errors.name) setErrors({});
              }}
              placeholder={t("drawer.namePlaceholder")}
              autoComplete="off"
              error={clashText ?? errors.name}
              description={
                clashText || errors.name
                  ? undefined
                  : org
                    ? t("drawer.nameHelp", { org: org.name })
                    : t("drawer.nameHelpNoName")
              }
            />
            <Field
              label={t("drawer.inside")}
              description={
                errors.inside
                  ? undefined
                  : inside === TOP && !name.trim()
                    ? t("drawer.atTheTopHint")
                    : t("drawer.where", { path: where.join(" › ") })
              }
              error={errors.inside}
            >
              <Combobox
                items={places}
                value={inside}
                onValueChange={(value) => {
                  setInside(value ? String(value) : TOP);
                  if (errors.inside) setErrors({});
                }}
                icon={SearchIcon}
                placeholder={t("drawer.insidePlaceholder")}
              />
            </Field>
            {moving && own?.children.length ? (
              <Alert
                tone="info"
                title={t("drawer.movesWith", { count: own.inside, n: n(own.inside) })}
              >
                {t("drawer.movesWithDetail", {
                  names: own.children.map((c) => c.name).join(", "),
                  name: own.name,
                })}
              </Alert>
            ) : null}
            <Field
              label={t("drawer.descriptionLabel")}
              optional
              description={t("drawer.descriptionHelp")}
            >
              <Textarea
                rows={2}
                maxRows={5}
                value={description}
                onValueChange={setDescription}
                placeholder={t("drawer.descriptionPlaceholder")}
              />
            </Field>
            {!editing && people ? (
              <Field
                label={t("drawer.members")}
                optional
                description={
                  members.length
                    ? t("drawer.membersChosen", { count: members.length, n: n(members.length) })
                    : t("drawer.membersHelp")
                }
              >
                <Combobox
                  multiple
                  items={people.map((p) => ({
                    value: p.id,
                    label: p.display_name?.trim() || p.email,
                    description: p.email,
                  }))}
                  value={members}
                  onValueChange={(values) => setMembers((values ?? []).map(String))}
                  icon={SearchIcon}
                  placeholder={t("drawer.membersPlaceholder")}
                />
              </Field>
            ) : null}
            {!editing && canGrant ? (
              <Field
                label={t("drawer.role")}
                optional
                description={
                  role
                    ? role.description?.trim()
                      ? t("drawer.roleHelp", { role: role.name, about: role.description.trim() })
                      : t("drawer.roleHelpNoAbout", { role: role.name })
                    : t("drawer.noRoleHelp")
                }
              >
                <Select
                  value={roleId}
                  onValueChange={(value) => setRoleId(String(value ?? ""))}
                  items={[
                    { value: "", label: t("drawer.noRole") },
                    ...roles.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </Field>
            ) : null}
          </form>
        </DrawerBody>
        <DrawerFooter>
          {!editing && onUseTemplate ? (
            // A start slot for the footer is QTRX-23; the Users drawer's class places it.
            <Link className="add-import" render={<button type="button" onClick={onUseTemplate} />}>
              <LayoutTemplateIcon className="add-import-icon" aria-hidden="true" />
              {t("drawer.useTemplate")}
            </Link>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("drawer.cancel")}
          </Button>
          {editing ? (
            <Button type="submit" form="group-drawer" loading={busy}>
              {t("drawer.save")}
            </Button>
          ) : (
            <Button
              type="submit"
              form="group-drawer"
              icon={PlusIcon}
              loading={busy}
              disabled={!!clash}
            >
              {t("drawer.create")}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
