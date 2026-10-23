import type { createCsrfMiddleware } from "@tanstack/react-start";

type CsrfOptions = NonNullable<Parameters<typeof createCsrfMiddleware>[0]>;

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

/**
 * The CSRF policy: every server function, whatever its method, and every unsafe-method request to
 * a server route must pass TanStack's same-origin check (Sec-Fetch-Site, else Origin, else
 * Referer; a request with none is refused). Safe-method server routes change nothing, so skip it.
 */
export const csrfPolicy: CsrfOptions = {
  filter: ({ handlerType, request }) =>
    handlerType === "serverFn" || !SAFE_METHODS.includes(request.method),
};
