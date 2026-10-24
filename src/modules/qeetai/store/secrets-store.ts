// In-memory store, keyed by execution id, for secrets a tool surfaces for one-time reveal. The
// conversation store persists to localStorage, and a signing key read from there could forge
// tokens for the whole tenant, so secrets live only here and are gone on reload.

import { Store, useStore } from "@tanstack/react-store";

import { onSessionClear } from "@/platform/auth/session-store";
import type { ToolResult } from "../tools/types/tool.types";

export type SensitiveArtifact = NonNullable<ToolResult["sensitiveArtifact"]>;

const secretsStore = new Store<Record<string, SensitiveArtifact>>({});

// A secret is the outgoing scope's; another person or organisation must never see it.
onSessionClear(() => secretsStore.setState(() => ({})));

export const secretsActions = {
  set(executionId: string, artifact: SensitiveArtifact) {
    secretsStore.setState((s) => ({ ...s, [executionId]: artifact }));
  },
  clear(executionId: string) {
    secretsStore.setState((s) => {
      if (!(executionId in s)) return s;
      const next = { ...s };
      delete next[executionId];
      return next;
    });
  },
};

export function useSensitiveArtifact(executionId: string): SensitiveArtifact | undefined {
  return useStore(secretsStore, (s) => s[executionId]);
}
