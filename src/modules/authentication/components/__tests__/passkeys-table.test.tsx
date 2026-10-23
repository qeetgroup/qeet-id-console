// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

import { ApiError } from "@/platform/errors/api-error";

import type { Passkey } from "@/modules/authentication/api/passkeys";
import { PasskeysTable, passkeyDisplayName } from "../passkeys-table";

afterEach(cleanup);

const base: Passkey = {
  id: "pk1",
  user_id: "u1",
  name: "Chrome on macOS",
  transports: ["internal"],
  created_at: "2026-10-01T10:00:00Z",
  last_used_at: null,
};

function renderTable(passkeys: Passkey[], onRename = vi.fn().mockResolvedValue(undefined)) {
  const onRemove = vi.fn();
  render(<PasskeysTable passkeys={passkeys} onRename={onRename} onRemove={onRemove} />);
  return { onRename, onRemove };
}

const nameInput = () => screen.getByRole("textbox", { name: "Passkey name" }) as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "Save name" }) as HTMLButtonElement;

describe("PasskeysTable", () => {
  it("renames inline: Rename opens an editor with the current name and Save sends the trimmed name", async () => {
    const { onRename } = renderTable([base]);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(nameInput().value).toBe("Chrome on macOS");

    fireEvent.change(nameInput(), { target: { value: "  Work laptop  " } });
    fireEvent.click(saveButton());

    expect(onRename).toHaveBeenCalledWith(base, "Work laptop");
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("labels a passkey enrolled without a name, which can then be named", () => {
    const { onRename } = renderTable([{ ...base, name: null }]);
    expect(screen.getByText("Unnamed passkey")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(nameInput().value).toBe("");
    fireEvent.change(nameInput(), { target: { value: "Phone" } });
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    expect(onRename).toHaveBeenCalledWith({ ...base, name: null }, "Phone");
  });

  it("won't save an empty or whitespace-only name", () => {
    const { onRename } = renderTable([base]);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    for (const value of ["", "   "]) {
      fireEvent.change(nameInput(), { target: { value } });
      expect(saveButton().disabled).toBe(true);
      fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    }
    expect(onRename).not.toHaveBeenCalled();
  });

  it("caps the name at the server's 64 characters", () => {
    const { onRename } = renderTable([base]);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(nameInput().maxLength).toBe(64);

    fireEvent.change(nameInput(), { target: { value: "a".repeat(65) } });
    expect(saveButton().disabled).toBe(true);
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    expect(onRename).not.toHaveBeenCalled();

    // Characters, not UTF-16 units, like the server: 64 accented letters fit.
    fireEvent.change(nameInput(), { target: { value: "é".repeat(64) } });
    expect(saveButton().disabled).toBe(false);
  });

  it("Escape cancels without saving", () => {
    const { onRename } = renderTable([base]);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(nameInput(), { target: { value: "Something else" } });
    fireEvent.keyDown(nameInput(), { key: "Escape" });

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Chrome on macOS")).toBeTruthy();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("keeps the editor open with safe copy when the rename is refused", async () => {
    const refused = vi
      .fn()
      .mockRejectedValue(new ApiError(404, "not_found", "internal: row 7 missing in auth.passkey"));
    renderTable([base], refused);
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    fireEvent.change(nameInput(), { target: { value: "Work laptop" } });
    fireEvent.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("auth.passkey");
    expect(nameInput().value).toBe("Work laptop");
  });

  it("shows markup and control characters in a name as plain text", () => {
    const markup = `<img src=x onerror="alert(1)"> & <b>Key</b>`;
    const { container } = render(
      <PasskeysTable
        passkeys={[{ ...base, name: markup }]}
        onRename={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(markup)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("asks the caller to remove a passkey", () => {
    const { onRemove } = renderTable([base]);
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith(base);
  });
});

describe("passkeyDisplayName", () => {
  it("falls back to the given label for a passkey without a name", () => {
    expect(passkeyDisplayName(base, "Unnamed passkey")).toBe("Chrome on macOS");
    expect(passkeyDisplayName({ ...base, name: null }, "Unnamed passkey")).toBe("Unnamed passkey");
    expect(passkeyDisplayName({ ...base, name: "  " }, "Unnamed passkey")).toBe("Unnamed passkey");
  });
});
