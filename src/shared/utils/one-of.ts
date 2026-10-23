/** True when `value` is one of `options`, narrowing it to their type. */
export function isOneOf<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value);
}
