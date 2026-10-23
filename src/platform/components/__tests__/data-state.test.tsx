// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "@/platform/errors/api-error";
import { DataState } from "../data-state";

afterEach(cleanup);

describe("DataState", () => {
  it("shows curated copy, not the backend message, for a failed load", () => {
    const error = new ApiError(500, "internal", 'pq: relation "tenant_users" does not exist');

    render(
      <DataState isError error={error}>
        <p>loaded</p>
      </DataState>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong. Please try again.",
    );
    expect(screen.queryByText(/tenant_users/)).toBeNull();
  });

  it("maps a known code to its message", () => {
    const error = new ApiError(401, "auth.session_expired", "token exp 1730000000 < now");

    render(
      <DataState isError error={error}>
        <p>loaded</p>
      </DataState>,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Your session has expired. Please sign in again.",
    );
    expect(screen.queryByText(/1730000000/)).toBeNull();
  });

  it("renders children once the data is ready", () => {
    render(
      <DataState isError={false} error={null}>
        <p>loaded</p>
      </DataState>,
    );

    expect(screen.getByText("loaded")).toBeTruthy();
  });
});
