import { createFileRoute } from "@tanstack/react-router";

// Liveness for container health checks: 200 once the server is serving.
// version/revision are stamped into container images at build time
// (QEET_BUILD_VERSION / QEET_BUILD_REVISION) and omitted where unset (Vercel).
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
