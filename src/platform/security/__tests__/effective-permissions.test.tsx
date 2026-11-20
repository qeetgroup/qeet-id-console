// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";

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
  it("reads the person's own permissions, which needs no permission to read", async () => {
    vi.mocked(api).mockResolvedValue({ permissions: ["organization.read"], grants: [] });
    const { result } = renderHook(() => useEffectivePermissions("user-1"), { wrapper });

    await waitFor(() =>
      expect(result.current.data).toMatchObject({ permissions: ["organization.read"] }),
    );
    expect(api).toHaveBeenCalledWith(
      "/v1/me/permissions",
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it("refuses a malformed answer rather than make a capability set of it", async () => {
    vi.mocked(api).mockResolvedValue({ permissions: [], grants: [] });
    renderHook(() => useEffectivePermissions("user-1"), { wrapper });
    await waitFor(() => expect(api).toHaveBeenCalled());
    const options = vi.mocked(api).mock.calls[0]?.[1] as { schema: ZodType } | undefined;
    assert(options, "the read's options");
    const { schema } = options;
    expect(schema.safeParse({ permissions: [], grants: [] }).success).toBe(true);
    expect(schema.safeParse({ permissions: [7], grants: [] }).success).toBe(false);
    expect(schema.safeParse({ grants: [] }).success).toBe(false);
  });
});
