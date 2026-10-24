// Reduces a path to its template, so a log names the route and never an id, email or token in it.

// A resource name is a lowercase word (`revoke-all`, `email-templates`), at most with a short
// version-like number (`v1`, `oauth2`); an instance carries digits, capitals, `@` or `%`. A route
// parameter (`$userId`) or splat (`$`) is already a placeholder.
function isTemplateSegment(segment: string): boolean {
  if (segment.startsWith("$")) return /^\$\w*$/.test(segment);
  if (segment === "{id}") return true;
  if (segment.length > 32 || !/^[a-z][a-z0-9._-]*$/.test(segment)) return false;
  return !/\d/.test(segment) || segment.length <= 6;
}

/** Returns the path without its query or fragment, each segment naming an instance as `{id}`. */
export function pathTemplate(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  return pathname
    .split("/")
    .map((segment) => (segment === "" || isTemplateSegment(segment) ? segment : "{id}"))
    .join("/");
}
