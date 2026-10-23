import { describe, expect, it } from "vitest";

import i18n from "@/i18n";

import { importRowErrorMessage } from "../import-errors";

const t = i18n.getFixedT("en", "users");

describe("importRowErrorMessage", () => {
  it("words a field problem with the field's own label", () => {
    expect(
      importRowErrorMessage(t, { line: 3, code: "user.import_field_missing", field: "email" }),
    ).toBe("Email is missing.");
    expect(
      importRowErrorMessage(t, {
        line: 3,
        code: "user.import_field_too_long",
        field: "display_name",
      }),
    ).toBe("Name is too long.");
  });

  it("tells a broken line from a file that couldn't be read at all", () => {
    expect(importRowErrorMessage(t, { line: 7, code: "user.import_row_malformed" })).toBe(
      "This line couldn't be read.",
    );
    expect(importRowErrorMessage(t, { code: "user.import_row_malformed" })).toBe(
      "The file couldn't be read.",
    );
  });

  it("words the account and password refusals for the row, not the person reading", () => {
    expect(importRowErrorMessage(t, { line: 2, code: "auth.email_exists", field: "email" })).toBe(
      "A user with this email already exists.",
    );
    expect(
      importRowErrorMessage(t, {
        line: 2,
        code: "authpolicy.password_no_number",
        field: "password",
      }),
    ).toBe("The password needs a number.");
  });

  it("falls back to generic wording for a code it doesn't know", () => {
    expect(importRowErrorMessage(t, { line: 2, code: "internal" })).toBe(
      "This user couldn't be created.",
    );
  });
});
