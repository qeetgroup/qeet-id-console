import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { beforeAll, describe, expect, it } from "vitest";

import { navContributions } from "@/platform/modules/registry";
import {
  getRequiredCapabilityForPath,
  registerRouteRequirements,
} from "@/platform/security/route-capability";
import { routeTree } from "@/routeTree.gen";

// Registers the real routes' requirements, as the router does at startup.
beforeAll(() => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  registerRouteRequirements(
    Object.values(router.routesById).map((route) => ({
      fullPath: route.fullPath,
      capability: route.options.staticData?.capability,
    })),
  );
});

describe("route capabilities", () => {
  it("takes a path's requirement from the route it opens", () => {
    expect(getRequiredCapabilityForPath("/users")).toBe("user.read");
    expect(getRequiredCapabilityForPath("/users/import")).toBe("user.write");
    expect(getRequiredCapabilityForPath("/users/4c1f")).toBe("user.read");
    expect(getRequiredCapabilityForPath("/users/suspended")).toBe("user.read");
    expect(getRequiredCapabilityForPath("/auth/connections/oidc/client-1")).toBe("connection.read");
    expect(getRequiredCapabilityForPath("/directory/sync-errors")).toBe("connection.read");
  });

  it("lets an unknown sub-path inherit its section's requirement", () => {
    expect(getRequiredCapabilityForPath("/authorization/roles/42")).toBe("role.read");
  });

  it("normalizes trailing slashes and queries without matching lookalike paths", () => {
    expect(getRequiredCapabilityForPath("/users/")).toBe("user.read");
    expect(getRequiredCapabilityForPath("/users?status=active")).toBe("user.read");
    expect(getRequiredCapabilityForPath("/users-archive")).toBeUndefined();
    expect(getRequiredCapabilityForPath("/unknown")).toBeUndefined();
  });

  it("matches each nav entry's capability to the route it opens", () => {
    const mismatched = navContributions()
      .filter((e) => e.capability !== getRequiredCapabilityForPath(e.url))
      .map((e) => `${e.id}: nav ${e.capability} / route ${getRequiredCapabilityForPath(e.url)}`);
    expect(mismatched).toEqual([]);
  });
});
