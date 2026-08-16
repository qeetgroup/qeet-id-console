import { sessionStore } from "@/platform/auth/session-store";

export function onAuthLost() {
  sessionStore.clear();
  if (typeof window !== "undefined" && window.location.pathname !== "/sign-in") {
    window.location.assign("/sign-in");
  }
}
