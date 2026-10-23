import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

/** The TanStack devtools panel for the query cache, mounted only when devtools are enabled. */
export const queryDevtoolsPlugin = {
  name: "Tanstack Query",
  render: <ReactQueryDevtoolsPanel />,
};
