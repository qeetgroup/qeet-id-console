import { useEffect, useState } from "react";

/**
 * Returns the resolved colour scheme from the `data-qx-color-scheme` attribute on <html>, which
 * the first-paint script and QeetrixProvider set. Only for what CSS can't branch on, such as a
 * `placeholder` or Monaco's theme; prefer `[data-qx-color-scheme="dark"]` in CSS elsewhere.
 * Starts false so the server and first client render agree; the effect then corrects it.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.getAttribute("data-qx-color-scheme") === "dark");
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["data-qx-color-scheme"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
