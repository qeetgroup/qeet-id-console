import { describe, expect, it } from "vitest";

import type { DirectoryMapping } from "../api/directory";
import {
  checkMapping,
  defaultProfile,
  effectiveProfile,
  fieldMappings,
  unmappedKeys,
} from "../mappings-model";

const rule = (patch: Partial<DirectoryMapping>): DirectoryMapping => ({
  id: "m1",
  source_attribute: "departmentNumber",
  target_field: "department",
  value_type: "string",
  transform: "none",
  pattern: "",
  enabled: true,
  required: false,
  version: 1,
  ...patch,
});
const ldap = { email_attribute: "mail", name_attribute: "cn" };

describe("Mappings", () => {
  it("shows a field's mapping that's on, else its newest one that's off", () => {
    const shown = fieldMappings([
      rule({ id: "off-old", enabled: false }),
      rule({ id: "on" }),
      rule({ id: "off-new", enabled: false }),
      rule({ id: "t1", target_field: "title", enabled: false }),
      rule({ id: "t2", target_field: "title", enabled: false }),
    ]);
    expect(shown.get("department")?.id).toBe("on");
    expect(shown.get("title")?.id).toBe("t2");
  });

  it("takes the email and name a sign-in takes when nothing maps them", () => {
    expect(
      defaultProfile("ldap", { mail: [" Ananya@Example.com "], cn: "Ananya Iyer" }, ldap),
    ).toEqual({
      email: "ananya@example.com",
      display_name: "Ananya Iyer",
    });
    expect(
      defaultProfile("scim", {
        emails: [{ value: "other@example.com" }, { value: "a@example.com", primary: true }],
        name: { givenName: "Ananya", familyName: "Iyer" },
      }),
    ).toEqual({ email: "a@example.com", display_name: "Ananya Iyer" });
  });

  it("lets a saved mapping's value win over the default, lowercasing an LDAP email", () => {
    expect(
      effectiveProfile(
        "ldap",
        { mail: "a@example.com", cn: "A" },
        { email: "B@Example.com" },
        ldap,
      ),
    ).toEqual({ email: "b@example.com", display_name: "A" });
  });

  it("lists the entry's attributes nothing reads", () => {
    const entry = { uid: "a", mail: "a@example.com", cn: "A", departmentNumber: "Eng", sn: "I" };
    expect(unmappedKeys("ldap", entry, [rule({})], ldap)).toEqual(["uid", "sn"]);
    expect(
      unmappedKeys("scim", { userName: "a", title: "T", name: {} }, [
        rule({ source_attribute: "/name/givenName", target_field: "first_name" }),
      ]),
    ).toEqual(["title"]);
  });

  it("refuses what the server would before it's sent", () => {
    const base = { transform: "none" as const, pattern: "" };
    expect(checkMapping({ ...base, source_attribute: "" }, "ldap")?.code).toBe("source_required");
    expect(checkMapping({ ...base, source_attribute: "userPassword" }, "ldap")?.code).toBe(
      "source_credential",
    );
    expect(checkMapping({ ...base, source_attribute: "/name/givenName" }, "ldap")?.code).toBe(
      "source_invalid",
    );
    expect(checkMapping({ ...base, source_attribute: "/name/givenName" }, "scim")).toBeNull();
    expect(
      checkMapping({ source_attribute: "mail", transform: "extract", pattern: "^[^@]+@" }, "ldap"),
    ).toEqual({ field: "pattern", code: "pattern_invalid" });
    expect(
      checkMapping(
        { source_attribute: "mail", transform: "extract", pattern: "^([^@]+)@(?:x)" },
        "ldap",
      ),
    ).toBeNull();
  });
});
