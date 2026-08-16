import { createFileRoute } from "@tanstack/react-router";

import { proxyQeetAIStream } from "@/platform/api/server-stream";

export const Route = createFileRoute("/api/qeetai-stream")({
  server: {
    handlers: {
      POST: ({ request }) => proxyQeetAIStream(request),
    },
  },
});
