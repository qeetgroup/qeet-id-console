import { describe, expect, it } from "vitest";

import { parseOutline } from "../components/group-templates-dialog";
import { parseImportRows } from "../components/import-groups-dialog";

describe("parseOutline (template builder)", () => {
  it("nests by two-space indentation", () => {
    const nodes = parseOutline("Engineering\n  Platform\n  Product\n    Web");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("Engineering");
    expect(nodes[0].children?.map((c) => c.name)).toEqual(["Platform", "Product"]);
    expect(nodes[0].children?.[1].children?.[0].name).toBe("Web");
  });

  it("keeps multiple roots", () => {
    expect(parseOutline("Sales\nSupport").map((n) => n.name)).toEqual(["Sales", "Support"]);
  });

  it("ignores blank lines rather than creating unnamed groups", () => {
    expect(parseOutline("A\n\n\n  B")[0].children?.[0].name).toBe("B");
  });

  it("attaches an over-indented line to the deepest level that exists", () => {
    // A stray extra space shouldn't drop the line or throw.
    const nodes = parseOutline("A\n      B");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children?.[0].name).toBe("B");
  });
});

describe("parseImportRows", () => {
  it("splits name, description and parent", () => {
    expect(parseImportRows("Platform,Core services,Engineering")).toEqual([
      { name: "Platform", description: "Core services", parent: "Engineering" },
    ]);
  });

  it("keeps commas inside the description", () => {
    // Splitting on every comma would silently truncate the description.
    expect(parseImportRows("Ops,Runs infra, on-call, and tooling,Engineering")).toEqual([
      { name: "Ops", description: "Runs infra, on-call, and tooling", parent: "Engineering" },
    ]);
  });

  it("treats a bare line as a top-level group", () => {
    expect(parseImportRows("Engineering")).toEqual([{ name: "Engineering" }]);
  });

  it("leaves the parent undefined when the trailing field is empty", () => {
    expect(parseImportRows("Engineering,Top level,")).toEqual([
      { name: "Engineering", description: "Top level", parent: undefined },
    ]);
  });
});
