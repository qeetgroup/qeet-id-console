import { describe, expect, it } from "vitest";

import { randomHex } from "../random-hex";

describe("randomHex", () => {
  it("is the asked number of bytes, as hex, different each time", () => {
    const a = randomHex(8);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(randomHex(8)).not.toBe(a);
  });
});
