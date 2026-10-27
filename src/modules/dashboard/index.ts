// Public API of the dashboard module: the console shell. Its pages are in pages.ts.
export { useAnalyticsOverview } from "./api/analytics";
export { ConsoleFrame } from "./components/frame/console-frame";
export { PageBreadcrumb, PageTabList, PageTabs } from "./components/frame/page-place";
// Until @qeetrix/react has them (QTRX-13): the small charts the Dashboard and the Users band share.
export { Sparkline, SplitBar } from "./components/overview/overview-parts";
