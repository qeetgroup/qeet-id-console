// First: the schema below parses at load, and Zod must not probe for eval before it.
import "./zod";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Client (VITE_*) variables only. Server variables are read from process.env at runtime and
// checked at startup by server-config.ts; `import.meta.env` never carries them.
export const env = createEnv({
  server: {},

  clientPrefix: "VITE_",

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_API_URL: z.string().url().optional(),
    // Build-time kill switch for Qeet AI, on by default; "false" turns it off entirely, as for
    // an air-gapped build. The runtime gate is the backend's `/v1/qeetai/status`.
    VITE_QEETAI_ENABLED: z.enum(["true", "false"]).optional(),
  },

  runtimeEnv: import.meta.env,

  emptyStringAsUndefined: true, // `VAR=` counts as unset, not as an empty value
});
