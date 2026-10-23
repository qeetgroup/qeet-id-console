// The capability each route's page requires, as the route itself declares it
// (`staticData: { capability }`). The router registers every route once it is built; the access
// boundary and link checks resolve a path against them. UX only: the backend still decides.

import type { Capability } from "@/platform/security/capability-model";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    capability?: Capability; // the capability the route's page requires
  }
}

type Requirement = { segments: readonly string[]; capability?: Capability };

let requirements: readonly Requirement[] = [];

function segmentsOf(pathname: string): string[] {
  return (pathname.split(/[?#]/, 1)[0] ?? "").split("/").filter(Boolean);
}

/** Records every route's path and required capability; the router calls it once it is built. */
export function registerRouteRequirements(
  routes: readonly { fullPath: string; capability?: Capability }[],
): void {
  requirements = routes
    .map((r) => ({ segments: segmentsOf(r.fullPath), capability: r.capability }))
    .filter((r) => !r.segments.includes("$")); // the not-found catch-all requires nothing
}

/**
 * Returns the capability a path's page requires: the route matching the whole path (a `$param`
 * matches any one segment, and static segments win), else the deepest route matching a leading
 * part of it, so an unknown sub-path inherits its section's requirement.
 */
export function getRequiredCapabilityForPath(pathname: string): Capability | undefined {
  const path = segmentsOf(pathname);
  let best: { score: number; capability?: Capability } | null = null;
  for (const route of requirements) {
    const { segments } = route;
    if (segments.length > path.length) continue;
    if (!segments.every((seg, i) => seg.startsWith("$") || seg === path[i])) continue;
    const statics = segments.filter((seg) => !seg.startsWith("$")).length;
    const score = (segments.length === path.length ? 10_000 : 0) + segments.length * 100 + statics;
    if (!best || score > best.score) best = { score, capability: route.capability };
  }
  return best?.capability;
}
