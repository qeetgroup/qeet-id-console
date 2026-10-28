import type { ColorScheme } from "@qeetrix/react";

/** Where the chosen colour scheme is kept, on this device for every account (the key predates
 * @qeetrix/react, so a choice made before the move still applies). */
export const COLOR_SCHEME_STORAGE_KEY = "qeetid-admin-theme";

const isColorScheme = (value: unknown): value is ColorScheme =>
  value === "light" || value === "dark" || value === "system";

/** The saved choice, or `system`. On the server there's none: it renders `system`, and the
 * first-paint script has already put the right scheme on <html> by the time the app hydrates. */
export function savedColorScheme(): ColorScheme {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return isColorScheme(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** Keeps the choice for the next visit. A browser that refuses storage just doesn't remember. */
export function saveColorScheme(scheme: ColorScheme): void {
  try {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  } catch {
    // Private mode or storage turned off: the choice lasts until the page reloads.
  }
}

/**
 * Runs while <head> parses and puts the saved (or the system's) scheme on <html>, so the first
 * paint is right; the provider alone would apply it after hydration, with a visible flash.
 */
export const colorSchemeFlashScript = `(function(){try{var t=localStorage.getItem("${COLOR_SCHEME_STORAGE_KEY}");if(t!=="dark"&&t!=="light"&&t!=="system")t="system";var r=t==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var h=document.documentElement;h.setAttribute("data-qx-color-scheme",r);h.style.colorScheme=r;}catch(e){}})();`;
