import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { assertProductionConfig } from "@/platform/config/server-config";
import { csrfPolicy } from "@/platform/security/csrf-policy";

// A production server with a missing or malformed SESSION_SECRET, backend URL
// or public API URL refuses to start rather than failing open per request.
if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  assertProductionConfig();
}

const csrfMiddleware = createCsrfMiddleware(csrfPolicy);

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
