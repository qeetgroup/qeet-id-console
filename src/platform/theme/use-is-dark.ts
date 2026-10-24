import { useEffect, useState } from "react";

/**
 * Returns the resolved colour scheme from the `dark` class the pre-hydration script puts on
 * <html>. Only for what CSS can't branch on, such as `placeholder`; prefer `.dark` elsewhere.
 * Starts false so the server and first client render agree; the effect then corrects it.
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
