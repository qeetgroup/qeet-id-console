// Public API of the dashboard module: the console shell. Its pages are in pages.ts.
export { useAnalyticsOverview } from "./api/analytics";
export { ConsoleFrame } from "./components/frame/console-frame";
export { PageBreadcrumb, PageTabList } from "./components/frame/page-place";
// The bands' share bar: its parts are ordered, and Qeetrix's ShareBar has no sequential tones yet.
export { SplitBar } from "./components/overview/overview-parts";
