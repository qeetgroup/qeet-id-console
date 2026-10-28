// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    tenantId: "t1",
    // Every capability, so every page and command is offered.
    permissions: { has: () => true },
  }),
}));
vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await vi.importActual<typeof import("@/platform/errors/api-error")>(
    "@/platform/errors/api-error",
  );
  return {
    ApiError,
    api: vi.fn(async () => ({
      results: [
        {
          type: "user",
          id: "u1",
          title: "Priya Patel",
          subtitle: "priya@org-one.example",
          url: "/users/u1",
          score: 1,
          status: "invited",
        },
      ],
    })),
  };
});

import { SearchPalette } from "../components/search-palette";
import { SearchProvider } from "../search-provider";
import { recentStore } from "../store/recent-store";

function renderPalette() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SearchProvider>
        <SearchPalette open onOpenChange={vi.fn()} hotkey />
      </SearchProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => recentStore.setState(() => ({ entries: [] })));
afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe("search or jump to", () => {
  it("offers the main actions before anything is typed", () => {
    renderPalette();
    expect(screen.getByPlaceholderText("Search or jump to…")).toBeTruthy();
    expect(screen.getByText("Actions")).toBeTruthy();
    expect(screen.queryByText("Recent")).toBeNull();
  });

  it("finds pages with where they live, records from the server, and opens one", async () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search or jump to…"), {
      target: { value: "pri" },
    });
    // The server's records come grouped by type once the query settles.
    const person = await screen.findByRole("option", { name: /Priya Patel/ });
    expect(screen.getByText("Users")).toBeTruthy();
    fireEvent.click(person);
    expect(navigate).toHaveBeenCalledWith({ to: "/users/u1" });
    await waitFor(() => expect(recentStore.state.entries[0]?.title).toBe("Priya Patel"));
  });

  it("names a page's area and its G shortcut", async () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search or jump to…"), {
      target: { value: "invitations" },
    });
    const page = await screen.findByRole("option", { name: /^Invitations/ });
    expect(page.textContent).toContain("Directory › Users");
  });
});
