// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LogoField } from "../logo-field";

afterEach(cleanup);

function preview() {
  return screen.queryByRole("img", { name: "Logo preview" });
}

// The typed URL is saved as the organization's logo: only an http(s) URL or an uploaded image
// may render.
describe("LogoField preview", () => {
  it("renders an https logo URL", () => {
    render(<LogoField value="https://example.com/logo.png" onChange={vi.fn()} />);

    expect(preview()?.getAttribute("src")).toBe("https://example.com/logo.png");
  });

  it("renders an uploaded image", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    render(<LogoField value={dataUrl} onChange={vi.fn()} />);

    expect(preview()?.getAttribute("src")).toBe(dataUrl);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "not a url"])(
    "never renders %s, and says why",
    (value) => {
      const onStatusChange = vi.fn();
      render(<LogoField value={value} onChange={vi.fn()} onStatusChange={onStatusChange} />);

      expect(preview()?.getAttribute("src") ?? null).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain("http(s) URL");
      expect(onStatusChange).toHaveBeenLastCalledWith("error");
    },
  );
});
