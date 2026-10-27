import { describe, expect, it } from "vitest";

import type { Group } from "../api/groups";
import {
  checkImport,
  importLines,
  outlineProblem,
  parseCsv,
  parseOutline,
  templateClashes,
  templateDepth,
  templateGroups,
} from "../groups-io-model";

const group = (name: string): Group => ({
  id: name,
  tenant_id: "t1",
  parent_id: null,
  name,
  description: "",
  created_at: "2025-08-18T10:00:00Z",
  member_count: 1,
});
const GROUPS = [group("Engineering"), group("Payments"), group("Operations")];

describe("parseCsv", () => {
  it("reads quoted fields, doubled quotes, any line end and a byte-order mark", () => {
    expect(parseCsv('﻿name,description\r\n"Treasury","Cash, funding"\n"Say ""hi""",x\n')).toEqual([
      ["name", "description"],
      ["Treasury", "Cash, funding"],
      ['Say "hi"', "x"],
    ]);
  });

  it("drops blank lines and keeps a last line without an end", () => {
    expect(parseCsv("a,b\n\n , \nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("importLines", () => {
  it("takes name, parent, description in that order, numbering the file's lines", () => {
    expect(importLines("Data,,Everyone\nAnalytics,Data,")).toEqual([
      { line: 1, name: "Data", description: "Everyone" },
      { line: 2, name: "Analytics", parent: "Data" },
    ]);
  });

  it("reads the columns by a header row, in any order", () => {
    expect(importLines("description,Group,Inside\nReports,Analytics,Data")).toEqual([
      { line: 2, name: "Analytics", parent: "Data", description: "Reports" },
    ]);
  });
});

describe("checkImport", () => {
  it("says what happens to each row before anything is sent", () => {
    const rows = checkImport(
      importLines(
        [
          "name,parent,description",
          "Treasury,Operations,",
          "Data,,",
          "Data Engineering,Data,",
          "payments,Engineering,",
          "Data,,again",
          "Brand,Marketing,",
          ",Sales,",
        ].join("\n"),
      ),
      GROUPS,
    );
    expect(rows.map((r) => [r.line, r.outcome])).toEqual([
      [2, "new"],
      [3, "new"],
      [4, "new"], // its parent is another row of the file
      [5, "exists"], // names ignore case
      [6, "repeated"],
      [7, "parent"],
      [8, "unnamed"],
    ]);
  });
});

describe("templates", () => {
  const nodes = parseOutline("Squad\n  Squad Engineering\n    Payments\n  Squad Design");

  it("counts a template's groups and levels, and finds the names already taken", () => {
    expect(templateGroups(nodes).map((n) => n.name)).toEqual([
      "Squad",
      "Squad Engineering",
      "Payments",
      "Squad Design",
    ]);
    expect(templateDepth(nodes)).toBe(3);
    expect(templateClashes(nodes, GROUPS).map((c) => c.name)).toEqual(["Payments"]);
  });

  it("holds an outline to the server's limits", () => {
    expect(outlineProblem([])).toBe("empty");
    expect(outlineProblem(nodes)).toBeNull();
    expect(
      outlineProblem(parseOutline("a\n  b\n    c\n      d\n        e\n          f\n            g")),
    ).toBe("depth");
    expect(
      outlineProblem(parseOutline(Array.from({ length: 201 }, (_, i) => `G${i}`).join("\n"))),
    ).toBe("size");
  });
});
