// Types for check-bundle-size.mjs, for its test.
export interface ManifestRoute {
  children?: string[];
  preloads?: string[];
  scripts?: { attrs?: { src?: string } }[];
}
export interface Measurement {
  shell: number; // gzip bytes
  routes: Record<string, number>; // gzip bytes beyond the parent route's initial JS
}
export interface Budgets {
  shell: number; // kB
  newRoute: number; // kB
  routes: Record<string, number>; // kB
}
export interface BudgetBreach {
  id: string;
  bytes: number;
  budget: number;
}

export const SHELL_ROUTE: string;
export function staticImports(url: string, code: string): string[];
export function staticClosure(
  entries: Iterable<string>,
  importsOf: (url: string) => string[],
): Set<string>;
export function routeChain(routes: Record<string, ManifestRoute>, id: string): string[];
export function measure(
  routes: Record<string, ManifestRoute>,
  importsOf: (url: string) => string[],
  gzipBytes: (url: string) => number,
): Measurement;
export function suggestBudget(bytes: number): number;
export function checkBudgets(
  measured: Measurement,
  budgets: Budgets,
): {
  over: BudgetBreach[];
  unbudgeted: { id: string; bytes: number }[];
  stale: string[];
  ok: boolean;
};
export function parseBudgets(text: string): Budgets;
