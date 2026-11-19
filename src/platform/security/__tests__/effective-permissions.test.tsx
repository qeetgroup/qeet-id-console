// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useOrganizationId: () => "org-1" }));

import { api } from "@/platform/api/client";
import { useEffectivePermissions } from "../effective-permissions";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.mocked(api).mockReset());

describe("useEffectivePermissions", () => {
  it("reads the person's permissions in their organization", async () => {
    vi.mocked(api).mockResolvedValue({ permissions: ["organization.read"] });
    const { result } = renderHook(() => useEffectivePermissions("user-1"), { wrapper });

    await waitFor(() =>
      expect(result.current.data).toEqual({ permissions: ["organization.read"] }),
    );
    expect(api).toHaveBeenCalledWith(
      "/v1/users/user-1/organizations/org-1/permissions",
      expect.objectContaining({ schema: expect.anything() }),
    );
  });
});
