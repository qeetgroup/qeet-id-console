// Lives beside the routes with a "-" prefix so the router generator ignores it. The pages that
// joined others keep their addresses: an old link or bookmark lands on the page that took them in.
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as AccessTester } from "./access-tester";
import { Route as Builder } from "./builder";
import { Route as Explorer } from "./explorer";
import { Route as Simulator } from "./simulator";

function landing(route: { options: { beforeLoad?: unknown } }) {
  try {
    (route.options.beforeLoad as () => void)();
  } catch (thrown) {
    if (isRedirect(thrown)) return thrown.options;
    throw thrown;
  }
  throw new Error("no redirect");
}

describe("old addresses", () => {
  it("send the Builder to ABAC's new policy, where a template's policy opens", () => {
    expect(landing(Builder)).toMatchObject({
      to: "/authorization/abac",
      search: { policy: "new" },
    });
  });

  it("send the Simulator, Explorer and Access tester to Testing", () => {
    expect(landing(Simulator)).toMatchObject({ to: "/authorization/testing" });
    expect(landing(Explorer)).toMatchObject({ to: "/authorization/testing" });
    expect(landing(AccessTester)).toMatchObject({
      to: "/authorization/testing",
      search: { mode: "permission" },
    });
  });

  it("keep their capability, so the address is still guarded before it moves", () => {
    expect(Builder.options.staticData?.capability).toBe("policy.read");
    expect(AccessTester.options.staticData?.capability).toBe("role.read");
  });
});
