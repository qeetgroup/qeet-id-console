import { useState } from "react";

/** State that starts again from `initial` whenever `key` changes, such as the page a filter leaves. */
export function useKeyedState<T>(key: string, initial: T) {
  const [state, setState] = useState({ key, value: initial });
  const value = state.key === key ? state.value : initial;
  return [value, (next: T) => setState({ key, value: next })] as const;
}
