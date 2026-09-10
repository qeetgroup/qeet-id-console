import { useEffect, useState } from "react";

/**
 * The resolved colour scheme, read from the `dark` class the pre-hydration
 * theme script puts on <html> (it has already collapsed "system" to a concrete
 * value). Use this only where CSS cannot branch on its own — attributes such as
 * `placeholder` — and prefer the `.dark` selector everywhere else.
 *
 * Starts `false` so the server and first client render agree; the effect
 * corrects it before paint.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
