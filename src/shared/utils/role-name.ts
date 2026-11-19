// The roles every organisation starts with, worded for people: the server names them owner, admin,
// member and viewer (InsertOwnerRole, InsertBuiltinRoles), with English descriptions. A role's name
// is unique in its organisation, ignoring case, so no custom role shares one. A custom role shows
// the name and description it was given. Exports keep the server's names.
import i18n, { type TranslationKey } from "@/i18n";

const BUILT_IN = {
  owner: { name: "common:role.owner.name", line: "common:role.owner.line" },
  admin: { name: "common:role.admin.name", line: "common:role.admin.line" },
  member: { name: "common:role.member.name", line: "common:role.member.line" },
  viewer: { name: "common:role.viewer.name", line: "common:role.viewer.line" },
} as const satisfies Record<string, { name: TranslationKey; line: TranslationKey }>;

const builtIn = (name: string) =>
  Object.hasOwn(BUILT_IN, name) ? BUILT_IN[name as keyof typeof BUILT_IN] : undefined;

/** A role's name as people read it: "Owner" for owner; a custom role's own name. */
export function roleDisplayName(name: string): string {
  const known = builtIn(name);
  return known ? i18n.t(known.name) : name;
}

/** What a role is for, in a line: a built-in role's from the catalogue, else its own. */
export function roleDescription(role: { name: string; description?: string | null }): string {
  const known = builtIn(role.name);
  return known ? i18n.t(known.line) : (role.description ?? "");
}
