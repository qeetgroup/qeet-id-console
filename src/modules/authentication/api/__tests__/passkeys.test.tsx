// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/platform/api/client";

import { PASSKEYS_KEY, useRenamePasskey } from "../passkeys";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});

beforeEach(() => vi.resetAllMocks());

describe("useRenamePasskey", () => {
  it("PATCHes the new name and refreshes every passkey view", async () => {
    vi.mocked(api).mockResolvedValue({ id: "pk1", name: "Work laptop" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRenamePasskey(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync({ id: "pk1", name: "Work laptop" });

    expect(api).toHaveBeenCalledWith("/v1/passkeys/pk1", {
      method: "PATCH",
      body: { name: "Work laptop" },
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PASSKEYS_KEY }));
  });
});
