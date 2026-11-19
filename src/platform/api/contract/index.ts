// The server's API contract as types: its five OpenAPI documents (contract/qeet-id-server), merged
// into one table of paths, and what each operation takes and answers. Types only: nothing here
// reaches the bundle.
import type { input as ZodInput, ZodType } from "zod";

import type * as access from "./generated/access.gen";
import type * as developer from "./generated/developer.gen";
import type * as federation from "./generated/federation.gen";
import type * as identity from "./generated/identity.gen";
import type * as operations from "./generated/operations.gen";
import type { Undocumented } from "./undocumented";

/** Every path the server serves, from all five documents (no path is in two of them). */
export type Paths = access.paths &
  identity.paths &
  federation.paths &
  developer.paths &
  operations.paths;

/** The named schemas of one document, such as `Schemas<"identity">["Organization"]`. */
export type Schemas<D extends keyof Documents> = Documents[D]["components"]["schemas"];
type Documents = {
  access: { components: access.components };
  identity: { components: identity.components };
  federation: { components: federation.components };
  developer: { components: developer.components };
  operations: { components: operations.components };
};

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** The paths that answer a method: `PathsFor<"post">` holds no read-only path. */
export type PathsFor<M extends HttpMethod> = {
  [P in keyof Paths]: Paths[P] extends Record<M, unknown> ? P : never;
}[keyof Paths];

/** One operation: what `M` on `P` takes and answers. */
export type Operation<P extends PathsFor<M>, M extends HttpMethod> =
  Paths[P] extends Record<M, infer O> ? O : never;

// What a request or response carries as JSON (SCIM answers its own JSON type).
type JsonOf<C> = C extends { content: { "application/json": infer B } }
  ? B
  : C extends { content: { "application/scim+json": infer B } }
    ? B
    : never;

type ParametersOf<O> = O extends { parameters: infer X } ? X : never;

/** The path's placeholders, such as `{ userID: string }`, or never when it has none. */
export type PathParams<O> = ParametersOf<O> extends { path: infer X } ? X : never;

/** The query the operation reads, or never when it reads none. */
export type QueryParams<O> =
  ParametersOf<O> extends { query?: infer Q }
    ? [Exclude<Q, undefined>] extends [never]
      ? never
      : Exclude<Q, undefined>
    : never;

/** The JSON body, or never when the operation takes none. */
export type RequestBody<O> = O extends { requestBody: infer B }
  ? JsonOf<B>
  : O extends { requestBody?: infer B }
    ? [Exclude<B, undefined>] extends [never]
      ? never
      : JsonOf<Exclude<B, undefined>>
    : never;

type BodyRequired<O> = O extends { requestBody: unknown } ? true : false;

type SuccessStatus = 200 | 201 | 202 | 203 | 206;

/** What a success answers: its JSON, undefined for 204, unknown for a body that isn't JSON. */
export type ResponseOf<O> = O extends { responses: infer R }
  ? {
      [K in keyof R]: K extends SuccessStatus
        ? [JsonOf<R[K]>] extends [never]
          ? unknown
          : JsonOf<R[K]>
        : K extends 204
          ? undefined
          : never;
    }[keyof R]
  : never;

/** What the server sends or accepts on `M` `P` beyond its document (undocumented.ts), or nothing. */
export type Extra<
  P,
  M extends HttpMethod,
> = `${Uppercase<M>} ${P & string}` extends keyof Undocumented
  ? Undocumented[`${Uppercase<M>} ${P & string}`]
  : unknown;
type ExtraBody<X> = X extends { body: infer B } ? B : unknown;
// A body the document lists in full although the server takes any part of it.
type Documented<B, X> = X extends { partial: true } ? Partial<B> : B;
type ExtraAnswer<X> = X extends { answer: infer A } ? A : unknown;

/** What `get` on a path answers, for a module's own types: `Answer<"/v1/me">`. */
export type Answer<P extends PathsFor<M>, M extends HttpMethod = "get"> = ResponseOf<
  Operation<P, M>
> &
  ExtraAnswer<Extra<P, M>>;

/** The body `M` on `P` takes (some documents also accept `null` for it; the console never sends one). */
export type Body<P extends PathsFor<M>, M extends HttpMethod> = Documented<
  NonNullable<RequestBody<Operation<P, M>>>,
  Extra<P, M>
> &
  ExtraBody<Extra<P, M>>;

type RequiredKeysOf<T> = T extends object
  ? { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]
  : never;

/**
 * Where a schema expects more than the contract promises: a field the contract doesn't have at all
 * (always drift), one it requires that the answer may leave out, or a value it refuses as null that
 * may be null. A narrower value (a literal, an enum) is a deliberate fail-closed check, not drift.
 */
export type ShapeProblems<R, I, At extends string = "answer"> =
  | (null extends R ? (null extends I ? never : `${At} may be null`) : never)
  | (NonNullable<I> extends readonly (infer IE)[]
      ? NonNullable<R> extends readonly (infer RE)[]
        ? ShapeProblems<RE, IE, `${At}[]`>
        : never
      : NonNullable<I> extends object
        ? NonNullable<R> extends object
          ?
              | `${At}.${Exclude<keyof NonNullable<I>, keyof NonNullable<R>> & string} isn't in the contract`
              | `${At}.${Exclude<RequiredKeysOf<NonNullable<I>>, RequiredKeysOf<NonNullable<R>> | Exclude<keyof NonNullable<I>, keyof NonNullable<R>>> & string} may be absent`
              | {
                  [K in keyof NonNullable<I> & keyof NonNullable<R> & string]: ShapeProblems<
                    NonNullable<R>[K],
                    NonNullable<I>[K],
                    `${At}.${K}`
                  >;
                }[keyof NonNullable<I> & keyof NonNullable<R> & string]
          : never
        : never);

// A schema must accept every answer the contract allows: one that requires a field the contract
// leaves optional fails at runtime on a valid answer, which is how `next_cursor` broke sign-in.
type AcceptsContract<R, S> = [ShapeProblems<R, ZodInput<S>>] extends [never]
  ? unknown
  : { "the schema expects more than the contract promises": ShapeProblems<R, ZodInput<S>> };

type PathPart<O> = [PathParams<O>] extends [never] ? { path?: never } : { path: PathParams<O> };
type QueryPart<O> = [QueryParams<O>] extends [never]
  ? { query?: never }
  : { query?: QueryParams<O> };
type BodyPart<O, X> = [RequestBody<O>] extends [never]
  ? { body?: never }
  : BodyRequired<O> extends true
    ? { body: Documented<RequestBody<O>, X> & ExtraBody<X> }
    : { body?: Documented<RequestBody<O>, X> & ExtraBody<X> };

/** A typed call's options: its path placeholders, query and body, as the contract has them. */
export type CallOptions<O, S, X = unknown> = PathPart<O> &
  QueryPart<O> &
  BodyPart<O, X> & {
    signal?: AbortSignal;
    anonymous?: boolean; // no session token, for public endpoints such as sign-up
    // Checks the answer at runtime, failing closed.
    schema?: S & AcceptsContract<ResponseOf<O> & ExtraAnswer<X>, S>;
  };

// The options argument is optional only when nothing in it is required.
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];
export type CallArgs<O, S, X = unknown> = [RequiredKeys<CallOptions<O, S, X>>] extends [never]
  ? [options?: CallOptions<O, S, X>]
  : [options: CallOptions<O, S, X>];

/** What a typed call resolves to: the schema's output when one is given, else the contract's. */
export type CallResult<O, S, X = unknown> = [S] extends [never]
  ? ResponseOf<O> & ExtraAnswer<X>
  : S extends ZodType<infer Out>
    ? Out
    : never;
