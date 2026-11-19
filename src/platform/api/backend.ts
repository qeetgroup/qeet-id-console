// The console's typed calls to Qeet ID. Each names a path as the contract writes it, with its
// placeholders filled from `path`, so a path, method, parameter, body or answer field the server's
// documents don't have fails the typecheck. Every call still leaves through api() and the BFF.
import type { ZodType } from "zod";

import { api } from "@/platform/api/client";
import type {
  CallArgs,
  CallResult,
  Extra,
  HttpMethod,
  Operation,
  PathsFor,
} from "@/platform/api/contract";

type Query = Record<string, string | number | boolean | undefined | null>;

type RawOptions = {
  path?: Record<string, string | number>;
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  anonymous?: boolean;
  schema?: ZodType;
};

/** Returns the path with each `{name}` replaced by its encoded value; throws when one is missing. */
export function fillPath(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{([^{}]+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === "") {
      throw new Error(`No value for {${name}} in ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

// The transport takes strings and numbers; a boolean goes as the word the server parses.
function queryOf(query: Query | undefined): Record<string, string | number> | undefined {
  if (!query) return undefined;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "boolean" ? String(value) : value;
  }
  return out;
}

function send(method: HttpMethod, template: string, options: RawOptions = {}) {
  const query = queryOf(options.query);
  // Only what was given, so a call reads as a plain api() call to the transport and its tests.
  const sent = {
    ...(method === "get" ? {} : { method: method.toUpperCase() as Uppercase<HttpMethod> }),
    ...(query ? { query } : {}),
    ...(options.body !== undefined ? { body: options.body } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.anonymous ? { anonymous: true } : {}),
    ...(options.schema ? { schema: options.schema } : {}),
  };
  const path = fillPath(template, options.path);
  return Object.keys(sent).length > 0 ? api(path, sent) : api(path);
}

type Caller<M extends HttpMethod> = <P extends PathsFor<M>, S extends ZodType = never>(
  path: P,
  ...args: CallArgs<Operation<P, M>, S, Extra<P, M>>
) => Promise<CallResult<Operation<P, M>, S, Extra<P, M>>>;

function caller<M extends HttpMethod>(method: M): Caller<M> {
  return ((path: string, options?: RawOptions) => send(method, path, options)) as Caller<M>;
}

/** Calls Qeet ID by its contract: `backend.get("/v1/users/{userID}", { path: { userID } })`. */
export const backend = {
  get: caller("get"),
  post: caller("post"),
  put: caller("put"),
  patch: caller("patch"),
  delete: caller("delete"),
};
