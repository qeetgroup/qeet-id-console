// Stand-ins the sign-in pages' tests mock modules with: the frame's parts (they need the
// navigation) and the router's Link (it needs a router). vi.mock factories import this file, so it
// imports nothing but React types: a factory that imported the module it mocks would never resolve.
import type { ComponentProps, ReactNode } from "react";

/** The dashboard barrel's frame parts as plain stand-ins, with a sign-in mix to report. */
export function dashboardStub(mix: { method: string; value: number }[] = []) {
  return {
    PageBreadcrumb: () => null,
    PageTabList: () => null,
    PageTabs: ({ children }: { children: ReactNode }) => children,
    SplitBar: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
    useAnalyticsOverview: () => ({ data: { login_methods_mix: mix } }),
  };
}

/** A router Link as a plain anchor, with its params and search in the href. */
export function RouterLink({
  to,
  params,
  search,
  children,
  ...props
}: ComponentProps<"a"> & {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  children?: ReactNode;
}) {
  const path = Object.entries(params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), to);
  const query = search ? new URLSearchParams(search).toString() : "";
  return (
    <a {...props} href={query ? `${path}?${query}` : path}>
      {children}
    </a>
  );
}
