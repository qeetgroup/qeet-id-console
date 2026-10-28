// Public API of the timeline module; other modules import from here only.
// The view is for a person's page (users); a route must not import this barrel, or the view and
// its CSS load with the shell.
export { PersonTimeline } from "./components/page/person-timeline";
export type { TimelineSearch } from "./timeline-model";
