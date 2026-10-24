import {
  createCsrfMiddleware,
  createMiddleware,
  createServerOnlyFn,
  createStart,
} from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { assertProductionConfig, productionConfigProblems } from "@/platform/config/server-config";
import { contentSecurityPolicy, createNonce } from "@/platform/security/content-security-policy";
import { csrfPolicy } from "@/platform/security/csrf-policy";
import { serverLog } from "@/platform/telemetry/server-log";

// A production server with a missing or malformed SESSION_SECRET, backend URL or public API URL
// refuses to start rather than failing open per request; the log names each variable, never its
// value. Server-only, so the check and the logger stay out of the browser bundle.
const checkProductionConfig = createServerOnlyFn(() => {
  if (process.env.NODE_ENV !== "production") return;
  const problems = productionConfigProblems();
  if (problems.length > 0) serverLog("error", "config.invalid", { problems });
  assertProductionConfig();
});

if (typeof window === "undefined") checkProductionConfig();

const csrfMiddleware = createCsrfMiddleware(csrfPolicy);

// A fresh nonce per response, in its Content-Security-Policy and in the context the router reads
// (src/router.tsx). The dev server injects its own unnonced scripts, so it gets no policy.
const cspMiddleware = createMiddleware().server(({ next }) => {
  const nonce = createNonce();
  if (!import.meta.env.DEV)
    setResponseHeader("Content-Security-Policy", contentSecurityPolicy(nonce));
  return next({ context: { nonce } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, cspMiddleware],
}));
