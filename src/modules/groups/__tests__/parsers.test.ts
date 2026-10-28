import { describe, expect, it } from "vitest";

import { parseOutline } from "../groups-io-model";

describe("parseOutline (template builder)", () => {
  it("nests by two-space indentation", () => {
    const nodes = parseOutline("Engineering\n  Platform\n  Product\n    Web");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.name).toBe("Engineering");
    expect(nodes[0]?.children?.map((c) => c.name)).toEqual(["Platform", "Product"]);
    expect(nodes[0]?.children?.[1]?.children?.[0]?.name).toBe("Web");
  });

  it("keeps multiple roots", () => {
    expect(parseOutline("Sales\nSupport").map((n) => n.name)).toEqual(["Sales", "Support"]);
  });

  it("ignores blank lines rather than creating unnamed groups", () => {
    expect(parseOutline("A\n\n\n  B")[0]?.children?.[0]?.name).toBe("B");
  });

  it("attaches an over-indented line to the deepest level that exists", () => {
    const nodes = parseOutline("A\n      B"); // a stray space must not drop the line or throw
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.children?.[0]?.name).toBe("B");
  });
});
