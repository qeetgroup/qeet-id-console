// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/platform/errors/api-error";
import { getContext } from "@/platform/query/query-client";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { api } from "@/platform/api/client";
import { useConsumeMagicLink } from "../flows";

// The /magic page shows the failure inline; the app-wide toast must not repeat it.
describe("useConsumeMagicLink", () => {
  it("leaves a failed sign-in to the page instead of toasting it", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(410, "auth.magic_link_expired", "expired"));
    const { queryClient } = getContext();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConsumeMagicLink(), { wrapper });

    act(() => result.current.mutate("token"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
