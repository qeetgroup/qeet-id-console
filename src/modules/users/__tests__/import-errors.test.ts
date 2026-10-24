import { describe, expect, it } from "vitest";

import { importRowErrorMessage } from "../import-errors";

describe("importRowErrorMessage", () => {
  it("words a field problem with the field's own label", () => {
    expect(
      importRowErrorMessage({ line: 3, code: "user.import_field_missing", field: "email" }),
    ).toBe("Email is missing.");
    expect(
      importRowErrorMessage({
        line: 3,
        code: "user.import_field_too_long",
        field: "display_name",
      }),
    ).toBe("Name is too long.");
  });

  it("tells a broken line from a file that couldn't be read at all", () => {
    expect(importRowErrorMessage({ line: 7, code: "user.import_row_malformed" })).toBe(
      "This line couldn't be read.",
    );
    expect(importRowErrorMessage({ code: "user.import_row_malformed" })).toBe(
      "The file couldn't be read.",
    );
  });

  it("words the account and password refusals for the row, not the person reading", () => {
    expect(importRowErrorMessage({ line: 2, code: "auth.email_exists", field: "email" })).toBe(
      "A user with this email already exists.",
    );
    expect(
      importRowErrorMessage({
        line: 2,
        code: "authpolicy.password_no_number",
        field: "password",
      }),
    ).toBe("The password needs a number.");
  });

  it("falls back to generic wording for a code it doesn't know", () => {
    expect(importRowErrorMessage({ line: 2, code: "internal" })).toBe(
      "This user couldn't be created.",
    );
  });
});
