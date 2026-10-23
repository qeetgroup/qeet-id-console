// Loads the real catalogue, so components under test render their English copy, not raw keys,
// and registers the modules' manifests, as the router does.
import "@/i18n";
import "@/app/register";

// Polyfills the browser APIs jsdom lacks and the @qeetrix/ui primitives touch on mount. Each is
// guarded, so this is a no-op in the default `node` environment.
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
