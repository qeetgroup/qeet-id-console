// Fields the console relies on that the contract leaves optional although the server always sends
// them (its Go struct has no `omitempty`). Naming them here checks them at runtime, failing closed
// with `client.schema_mismatch` if one is missing, and makes them required in the type. Each use is
// server evidence for the document: once it marks the field required, the `assured` call can go.
import { z } from "zod";

import type { ShapeProblems } from "@/platform/api/contract";

/** T with the fields K always there and never null. */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const present = (record: Record<string, unknown>, fields: readonly PropertyKey[]) =>
  fields.every(
    (field) => record[field as string] !== undefined && record[field as string] !== null,
  );

/** A schema for one record whose `fields` must be present: `assured<User>()("id", "email")`. */
export function assured<T extends object>() {
  return <K extends keyof T>(...fields: K[]) =>
    z
      .custom<T>(isRecord)
      .refine((record) =>
        present(record as Record<string, unknown>, fields),
      ) as unknown as z.ZodType<WithRequired<T, K>, T>;
}

// Indexed, not inferred: a page is often the generic page and its own, intersected, and inference
// would pick the generic one's empty item.
type ItemOf<P> = P extends { items?: unknown }
  ? NonNullable<P["items"]>[number & keyof NonNullable<P["items"]>]
  : never;

/** A page whose `items` must be a list, each with `fields` present. */
export function assuredItems<P extends { items?: unknown }>() {
  return <K extends keyof ItemOf<P>>(...fields: K[]) =>
    z.custom<P>(isRecord).refine((page) => {
      const items = (page as { items?: unknown }).items;
      return Array.isArray(items) && items.every((item) => isRecord(item) && present(item, fields));
    }) as unknown as z.ZodType<Omit<P, "items"> & { items: WithRequired<ItemOf<P>, K>[] }, P>;
}

type ElementOf<L> = NonNullable<L> extends readonly (infer I)[] ? I : never;

/** T whose list `key`, when sent, holds items each with `fields` present. */
export function assuredList<T extends object>() {
  return <L extends keyof T, K extends keyof ElementOf<T[L]>>(key: L, ...fields: K[]) =>
    z.custom<T>(isRecord).refine((record) => {
      const list = (record as Record<string, unknown>)[key as string];
      return (
        list === undefined ||
        (Array.isArray(list) && list.every((item) => isRecord(item) && present(item, fields)))
      );
    }) as unknown as z.ZodType<Omit<T, L> & { [P in L]?: WithRequired<ElementOf<T[L]>, K>[] }, T>;
}

type NotInContract<T, S> = Extract<ShapeProblems<T, z.input<S>>, `${string} isn't in the contract`>;

/**
 * Holds the answer T to `schema`, which may require fields T leaves optional or refuse a null T
 * allows (the server always sends them), but may name no field T lacks: that is drift, and fails
 * the typecheck. Checked at runtime, failing closed.
 */
export function strictly<T extends object>() {
  return <S extends z.ZodType>(
    schema: S &
      ([NotInContract<T, S>] extends [never]
        ? unknown
        : { "the schema names fields the contract doesn't have": NotInContract<T, S> }),
  ) =>
    (z.custom<T>(isRecord) as z.ZodType).pipe(schema as z.ZodType) as unknown as z.ZodType<
      z.output<S>,
      T
    >;
}
