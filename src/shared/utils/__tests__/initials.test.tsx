// @vitest-environment jsdom
import { Avatar } from "@qeetrix/react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { initialsOf } from "../initials";

afterEach(cleanup);

describe("initialsOf", () => {
  it.each([
    "Priya Sharma",
    "priya",
    "  Mareedu   Sai Babu ",
    "Ñandú López",
    "अर्जुन शर्मा",
    "李 小龙",
    "😀 Smile",
  ])("gives the initials the library's Avatar shows for %j", (name) => {
    const { container } = render(<Avatar name={name} decorative />);
    const shown = container.querySelector('[data-slot="avatar-fallback"]')?.textContent ?? "";
    expect(initialsOf(name)).toBe(shown);
  });
});
