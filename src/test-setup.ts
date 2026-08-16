// jsdom polyfills for component tests. jsdom lacks several browser APIs that the
// @qeetrix/ui (base-ui) primitives touch on mount (media queries, resize/observe,
// pointer capture, scrolling). Each is guarded so this is a no-op under the
// default `node` test environment.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: test-only shims
  const g = globalThis as any;
  g.ResizeObserver ??= Observer;
  g.IntersectionObserver ??= Observer;

  const proto = window.HTMLElement.prototype;
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
}
