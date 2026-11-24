// What the server sends or accepts that its API documents leave out, keyed `METHOD path`. Each entry
// names the server code that shows it, is reported for the document, and goes once the document has
// it; `bun run contract:check` prints how many are left. Never add a field the server lacks.

/**
 * Per operation: `answer` fields it sends, `body` fields it accepts, and `partial` when the server
 * takes any part of a body the document lists as required.
 */
export type Undocumented = Record<never, never>;
