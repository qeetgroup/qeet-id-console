/**
 * A full page load: into the console once an organisation exists (so it starts in the new one),
 * or out to a hosted checkout. One seam, so tests can see where the page went.
 */
export function loadPage(url: string) {
  window.location.assign(url);
}
