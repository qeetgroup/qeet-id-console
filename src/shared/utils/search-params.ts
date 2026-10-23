// Building blocks for route search schemas. A value that is blank, malformed or unknown becomes
// undefined, so a hand-edited or stale URL opens the page instead of failing the route.
import { z } from "zod";

/** An optional, non-blank string. */
export function searchText() {
  return z
    .string()
    .refine((v) => v.trim() !== "")
    .optional()
    .catch(undefined);
}

/** An optional value from `values`. */
export function searchEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values).optional().catch(undefined);
}
