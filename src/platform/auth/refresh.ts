import { API_BASE_URL } from "@/platform/config/api-base-url";
import { tokenStore } from "@/platform/auth/token-store";
import { newRequestId } from "@/platform/telemetry/tracing";

// Single-flight refresh: if many queries hit a 401 at once they all await the
// same in-flight `/v1/auth/refresh` instead of stampeding the endpoint (which
// would revoke the session on the second request, since refresh tokens are
// rotated single-use server-side — see auth/service.go Refresh()).
let refreshInFlight: Promise<string | null> | null = null;

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
};

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const rt = tokenStore.getRefresh();
  if (!rt) return null;

  refreshInFlight = (async () => {
    try {
      const url = new URL("v1/auth/refresh", `${API_BASE_URL}/`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Request-Id": newRequestId(),
        },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      tokenStore.set(data.access_token);
      tokenStore.setRefresh(data.refresh_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function onAuthLost() {
  tokenStore.clear();
  if (typeof window !== "undefined" && window.location.pathname !== "/sign-in") {
    window.location.assign("/sign-in");
  }
}
