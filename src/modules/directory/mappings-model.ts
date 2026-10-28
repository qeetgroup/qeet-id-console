// Directories › Mappings: its rules, pure so the page and its tests share them. A mapping fills one
// Qeet ID field from one directory attribute, for one connection (internal/federation/directory):
// one mapping a field is on at a time; an LDAP mapping names an attribute, a SCIM one a key or a
// path into the entry (/name/givenName). With no mapping, LDAP takes the email and name from the
// connection's own attributes (mail, cn by default) and SCIM from userName and displayName
// (federation/ldap authenticate, federation/scim createUser); the server's preview leaves those
// out, so the console adds them as the sign-in would.

import type { DirectoryMapping, MappingInput } from "./api/directory";

/** The fields, in the page's order: the account's two, then the directory profile's. */
export const TARGETS = [
  "email",
  "display_name",
  "first_name",
  "last_name",
  "title",
  "department",
  "manager_id",
  "groups",
] as const;
export type Target = (typeof TARGETS)[number];

export const TRANSFORMS = ["none", "trim", "lowercase", "uppercase", "extract"] as const;

export type ConnectionKind = "scim" | "ldap";

/** An LDAP connection's own attributes for the email and the name. */
export type LdapAttributes = { email_attribute: string; name_attribute: string };

/** Each field's mapping on show: the one that's on, else the newest one that's off. */
export function fieldMappings(mappings: readonly DirectoryMapping[]) {
  const out = new Map<string, DirectoryMapping>();
  for (const m of mappings) {
    const shown = out.get(m.target_field);
    if (!shown || (m.enabled && !shown.enabled) || (m.enabled === shown.enabled && !shown.enabled))
      out.set(m.target_field, m);
  }
  return out;
}

/** Where the email or name comes from with no mapping; null for the other fields. */
export function defaultSource(
  kind: ConnectionKind,
  target: string,
  ldap?: LdapAttributes,
): string | null {
  if (target === "email") return kind === "scim" ? "userName" : (ldap?.email_attribute ?? "mail");
  if (target === "display_name")
    return kind === "scim" ? "displayName" : (ldap?.name_attribute ?? "cn");
  return null;
}

const first = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

/** The email and name a sign-in or SCIM change takes from an entry when nothing maps them. */
export function defaultProfile(
  kind: ConnectionKind,
  entry: Record<string, unknown>,
  ldap?: LdapAttributes,
): { email?: string; display_name?: string } {
  if (kind === "ldap") {
    const email = first(entry[ldap?.email_attribute ?? "mail"])
      ?.trim()
      .toLowerCase();
    const name = first(entry[ldap?.name_attribute ?? "cn"]);
    return { ...(email ? { email } : {}), ...(name ? { display_name: name } : {}) };
  }
  const emails = Array.isArray(entry.emails)
    ? (entry.emails as { value?: unknown; primary?: unknown }[])
    : [];
  const email =
    (typeof entry.userName === "string" && entry.userName.trim()) ||
    emails.find((e) => e?.primary === true && typeof e.value === "string" && e.value)?.value ||
    (typeof emails[0]?.value === "string" ? emails[0].value : undefined);
  const name = entry.name as { formatted?: unknown; givenName?: unknown; familyName?: unknown };
  const display =
    (typeof entry.displayName === "string" && entry.displayName) ||
    (typeof name?.formatted === "string" && name.formatted) ||
    `${typeof name?.givenName === "string" ? name.givenName : ""} ${typeof name?.familyName === "string" ? name.familyName : ""}`.trim();
  return {
    ...(typeof email === "string" && email.trim() ? { email: email.trim() } : {}),
    ...(display ? { display_name: display } : {}),
  };
}

/** The profile an entry makes: the defaults, then what the saved mappings set (the server's). */
export function effectiveProfile(
  kind: ConnectionKind,
  entry: Record<string, unknown>,
  mapped: Record<string, unknown>,
  ldap?: LdapAttributes,
): Record<string, unknown> {
  const profile: Record<string, unknown> = { ...defaultProfile(kind, entry, ldap), ...mapped };
  // A mapped LDAP email is lowercased as the sign-in does.
  if (kind === "ldap" && typeof mapped.email === "string")
    profile.email = mapped.email.toLowerCase();
  return profile;
}

/** The entry's top-level attributes no mapping and no default reads. */
export function unmappedKeys(
  kind: ConnectionKind,
  entry: Record<string, unknown>,
  mappings: readonly DirectoryMapping[],
  ldap?: LdapAttributes,
): string[] {
  const read = new Set<string>();
  for (const m of mappings) {
    if (!m.enabled) continue;
    read.add(m.source_attribute);
    if (m.source_attribute.startsWith("/"))
      read.add(m.source_attribute.slice(1).split("/")[0] ?? "");
  }
  if (kind === "ldap") {
    read.add(ldap?.email_attribute ?? "mail");
    read.add(ldap?.name_attribute ?? "cn");
  } else {
    for (const key of ["userName", "emails", "displayName", "name"]) read.add(key);
  }
  return Object.keys(entry).filter((key) => !read.has(key));
}

const CREDENTIAL = [
  "password",
  "passwd",
  "token",
  "secret",
  "credential",
  "privatekey",
  "private_key",
];
const LDAP_ATTRIBUTE = /^[A-Za-z][A-Za-z0-9;-]*$/;

/** Capture groups in a pattern, without compiling it: the server's engine (RE2) isn't the browser's. */
function captureGroups(pattern: string): number {
  let groups = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "\\") i++;
    else if (
      pattern[i] === "(" &&
      (pattern[i + 1] !== "?" || pattern[i + 2] === "P" || pattern[i + 2] === "<")
    )
      groups++;
  }
  return groups;
}

/** The mapping's problem before it's sent, as the server would name it; null when it may go. */
export function checkMapping(
  input: Pick<MappingInput, "source_attribute" | "transform" | "pattern">,
  kind: ConnectionKind,
): { field: "source_attribute" | "pattern"; code: string } | null {
  const source = input.source_attribute;
  if (!source.trim()) return { field: "source_attribute", code: "source_required" };
  if (source.length > 128 || source.trim() !== source)
    return { field: "source_attribute", code: "source_invalid" };
  if (CREDENTIAL.some((word) => source.toLowerCase().includes(word)))
    return { field: "source_attribute", code: "source_credential" };
  if (kind === "ldap" && !LDAP_ATTRIBUTE.test(source))
    return { field: "source_attribute", code: "source_invalid" };
  if (input.transform === "extract") {
    if (!input.pattern || input.pattern.length > 256 || captureGroups(input.pattern) !== 1)
      return { field: "pattern", code: "pattern_invalid" };
  }
  return null;
}

/** An entry to start the test from, with the attributes the connection reads. */
export function exampleEntry(kind: ConnectionKind, ldap?: LdapAttributes): string {
  const entry =
    kind === "scim"
      ? {
          userName: "ananya.iyer@example.com",
          displayName: "Ananya Iyer",
          name: { givenName: "Ananya", familyName: "Iyer" },
          title: "Senior Software Engineer",
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
            department: "Engineering",
          },
        }
      : {
          uid: "ananya.iyer",
          [ldap?.email_attribute ?? "mail"]: "ananya.iyer@example.com",
          [ldap?.name_attribute ?? "cn"]: "Ananya Iyer",
          givenName: "Ananya",
          sn: "Iyer",
          title: "Senior Software Engineer",
          departmentNumber: "Engineering",
        };
  return JSON.stringify(entry, null, 2);
}
