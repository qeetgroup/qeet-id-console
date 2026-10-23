// The console's modules. Adding one is creating its folder (start from templates/module) and adding
// its id here: its routes, manifest and translations are picked up from the folder.
// Plain data, so the router generator can read it in Node.
export const MODULES = [
  "dashboard",
  "activity",
  "timeline",
  "users",
  "groups",
  "organizations",
  "directory",
  "authentication",
  "authorization",
  "security",
  "compliance",
  "developer",
  "branding",
  "billing",
  "qeetai",
  "account",
  "onboarding",
  "search",
] as const;

export type ModuleId = (typeof MODULES)[number];
