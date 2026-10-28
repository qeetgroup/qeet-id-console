// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OneTimeSecret } from "../one-time-secret";

afterEach(cleanup);

describe("OneTimeSecret", () => {
  it("shows each value in full with its own Copy button, the first one focused", () => {
    const onDismiss = vi.fn();
    render(
      <OneTimeSecret
        title="Client credentials for build-bot"
        description="Shown only once."
        values={[
          { label: "client_id=", value: "spc_build_bot" },
          { label: "client_secret=", value: "sp_secret_value" },
        ]}
        dismissLabel="I've stored it"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("client_secret=sp_secret_value")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy client_secret=" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy client_id=" }));
    fireEvent.click(screen.getByRole("button", { name: "I've stored it" }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
