import { createFileRoute } from "@tanstack/react-router";

// Liveness for container health checks. version and revision come from QEET_BUILD_VERSION and
// QEET_BUILD_REVISION, stamped into images at build time, and are omitted where unset.
export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: () => {
        const body: Record<string, string> = { status: "ok", service: "qeet-id-console" };
        if (process.env.QEET_BUILD_VERSION) body.version = process.env.QEET_BUILD_VERSION;
        if (process.env.QEET_BUILD_REVISION) body.revision = process.env.QEET_BUILD_REVISION;
        return Response.json(body, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
