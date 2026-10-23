import { describe, expect, it } from "vitest";

import { parseImportFile } from "../import-file";

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
