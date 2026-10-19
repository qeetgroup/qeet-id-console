import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));

import { api } from "@/platform/api/client";
import { rotateSigningKeysTool } from "../definitions/credentials.tools";
import type { ToolContext } from "../types/tool.types";

const ctx = {
  tenantId: "tenant-a",
  userId: "operator-1",
  queryClient: new QueryClient(),
  signal: new AbortController().signal,
  can: () => true,
  confirm: async () => true,
  stepUp: async () => true,
} as unknown as ToolContext;

describe("rotate_signing_keys", () => {
  it("calls nothing, because signing keys rotate by deployment", async () => {
    const result = await rotateSigningKeysTool.run(ctx, {});

    expect(api).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.sensitiveArtifact).toBeUndefined();
    expect(result.error?.message).toMatch(/rotate by deployment/i);
  });
});
