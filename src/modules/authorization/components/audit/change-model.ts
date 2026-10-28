// What an authorization change is about, in words, from the event and the console's own lists:
// the audit log keeps IDs and a little metadata (a policy's or role's name, a relationship's three
// parts, a granted role's ID), and the console names the rest from roles, people and groups.

import i18n from "@/i18n";
import { type ActivityEvent, changeTitle } from "@/modules/authorization/api/authz-activity";

export type ChangeContext = {
  roleName: (id: string) => string | undefined;
  personName: (id: string) => string | undefined;
  groupName: (id: string) => string | undefined;
  policyName: (id: string) => string | undefined;
};

export type ChangeTarget = {
  /** The role a grant or revoke is of, for "Role to whom". */
  role?: string;
  /** What it's on: a policy, a role, a person, a group or a relationship. */
  label: string;
  /** The label is an ID or a relationship's raw parts, set in code type. */
  mono: boolean;
  /** Where its record opens in the console, when it has one. */
  link?:
    | { to: "/groups/$groupId"; params: { groupId: string } }
    | { to: "/users/$userId"; params: { userId: string } }
    | { to: "/authorization/roles"; search: { role: string } };
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);
const short = (id: string | undefined) => (id ? id.slice(0, 8) : "—");

/** A relationship's subject, a person's name for `user:<id>`. */
function subjectLabel(subject: string, ctx: ChangeContext): string {
  const [type, rest] = subject.split(":", 2);
  if (type === "user" && rest) return ctx.personName(rest.split("#")[0] ?? "") ?? subject;
  return subject;
}

export function changeTarget(e: ActivityEvent, ctx: ChangeContext): ChangeTarget {
  const id = e.target?.id;
  const meta = e.metadata ?? {};
  const roleId = text(meta.role_id);
  switch (e.type) {
    case "abac_policy.created":
    case "abac_policy.updated":
    case "abac_policy.deleted": {
      const name = text(meta.name) ?? (id ? ctx.policyName(id) : undefined);
      return { label: name ?? short(id), mono: !name };
    }
    case "role.created": {
      const name = text(meta.name) ?? (id ? ctx.roleName(id) : undefined);
      return {
        label: name ?? short(id),
        mono: !name,
        link:
          id && ctx.roleName(id) ? { to: "/authorization/roles", search: { role: id } } : undefined,
      };
    }
    case "role.assigned":
    case "role.unassigned": {
      const person = id ? ctx.personName(id) : undefined;
      return {
        role: (roleId && ctx.roleName(roleId)) || short(roleId),
        label: person ?? short(id),
        mono: !person,
        link: id && person ? { to: "/users/$userId", params: { userId: id } } : undefined,
      };
    }
    case "role.group_assigned":
    case "role.group_unassigned": {
      const group = id ? ctx.groupName(id) : undefined;
      return {
        role: (roleId && ctx.roleName(roleId)) || short(roleId),
        label: group ?? short(id),
        mono: !group,
        link: id && group ? { to: "/groups/$groupId", params: { groupId: id } } : undefined,
      };
    }
    default: {
      const object = text(meta.object);
      const relation = text(meta.relation);
      const subject = text(meta.subject);
      if (object && relation && subject)
        return {
          label: i18n.t("authorization:lists.audit.cells.relationship", {
            subject: subjectLabel(subject, ctx),
            relation,
            object,
          }),
          mono: false,
        };
      return { label: short(id), mono: true };
    }
  }
}

/** Who made the change: the person's name, from the event or the people list. */
export function actorName(e: ActivityEvent, ctx: ChangeContext): string | undefined {
  const name = e.actor?.name?.trim();
  if (name) return name;
  return e.actor?.id ? ctx.personName(e.actor.id) : undefined;
}

/** A change's title in words; any action without one shows the server's title. */
export function titleText(e: ActivityEvent): string {
  const key = changeTitle(e.type);
  return key ? i18n.t(`authorization:lists.audit.titles.${key}`) : e.title || e.type;
}
