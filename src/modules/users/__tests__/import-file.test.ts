import { describe, expect, it } from "vitest";

import { checkImportRows, parseImportFile } from "../import-file";

describe("parseImportFile", () => {
  it("numbers CSV rows by their line in the file, past blank lines", () => {
    const rows = parseImportFile(
      "users.csv",
      'email,display_name\r\na@example.test,Asha\n\n\nb@example.test,"Bea, Jr"\n',
    );
    expect(rows).toEqual([
      { email: "a@example.test", display_name: "Asha", line: 2 },
      { email: "b@example.test", display_name: "Bea, Jr", line: 5 },
    ]);
  });

  it("marks a row without an email, with a code rather than text", () => {
    const [row] = parseImportFile("users.csv", "email,phone\n,+15555550100\n");
    expect(row).toMatchObject({
      line: 2,
      error: { code: "user.import_field_missing", field: "email", line: 2 },
    });
  });

  it("reads NDJSON by extension and marks a line that isn't JSON", () => {
    const rows = parseImportFile("users.jsonl", '{"email":"a@example.test"}\n\nnot json\n');
    expect(rows).toEqual([
      { email: "a@example.test", line: 1 },
      { email: "", line: 3, error: { code: "user.import_row_malformed", line: 3 } },
    ]);
  });
});

describe("checkImportRows", () => {
  const rows = (text: string) => parseImportFile("users.csv", text);

  it("keeps the first of an address used twice, and leaves out one already in the organisation", () => {
    const checked = checkImportRows(
      rows("email\nA@example.test\nb@example.test\nB@Example.test\n"),
      new Set(["a@example.test"]),
    );
    expect(checked.map((r) => r.problem)).toEqual(["member", undefined, "duplicate"]);
  });

  it("sends a phone in E.164, and leaves out one without its country code", () => {
    const checked = checkImportRows(
      rows("email,phone\na@example.test,+91 98765 43210\nb@example.test,98765 43210\n"),
      new Set(),
    );
    expect(checked[0]).toMatchObject({ phone: "+919876543210" });
    expect(checked[0]?.problem).toBeUndefined();
    expect(checked[1]?.problem).toBe("phone");
  });

  it("marks a row the file couldn't give an address for, and one that isn't an address", () => {
    const checked = checkImportRows(rows("email\n,\nnot-an-email\n"), new Set());
    expect(checked.map((r) => r.problem)).toEqual(["parse", "email"]);
  });
});
