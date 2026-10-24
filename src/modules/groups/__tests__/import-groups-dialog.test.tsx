// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));

import { api } from "@/platform/api/client";
import { ImportGroupsDialog } from "../components/import-groups-dialog";

afterEach(cleanup);

describe("ImportGroupsDialog", () => {
  it("words each refused row by its code, never the server's reason", async () => {
    vi.mocked(api).mockResolvedValue({
      created: 1,
      skipped: 1,
      failed: 3,
      rows: [
        { name: "Engineering", status: "created" },
        { name: "Sales", status: "skipped", code: "group.import_name_exists", reason: "exists" },
        { name: "", status: "failed", code: "group.import_name_required", field: "name" },
        { name: "Platform", status: "failed", code: "group.import_parent_not_found" },
        { name: "Ops", status: "failed", code: "internal", reason: "Server text." },
      ],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportGroupsDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Engineering\nSales" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(
        "A group with this name already exists, or an earlier row creates one.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("This row has no name.")).toBeTruthy();
    expect(
      screen.getByText(
        "Its parent is neither a group nor another row here, or the rows form a loop.",
      ),
    ).toBeTruthy();
    // A code the console doesn't know reads as the generic failure, not the server's text.
    expect(
      screen.getByText("Couldn't be created. Check the name and that its parent exists."),
    ).toBeTruthy();
    expect(screen.queryByText("Server text.")).toBeNull();
  });
});
