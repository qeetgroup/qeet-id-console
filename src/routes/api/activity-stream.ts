import { createFileRoute } from "@tanstack/react-router";

import { proxyActivityStream } from "@/platform/api/server-stream";

export const Route = createFileRoute("/api/activity-stream")({
  server: {
    handlers: {
      GET: ({ request }) => proxyActivityStream(request),
    },
  },
});
