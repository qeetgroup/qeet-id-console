import type { MachineKind } from "@/modules/developer/machine-model";

/** Machine access's tabs: everything, then each kind. Each is its own route (a sub-page). */
export type MachineTab = "all" | MachineKind;

export const TAB_URL: Record<MachineTab, string> = {
  all: "/developer/machine-access",
  key: "/auth/api/keys",
  identity: "/auth/api/machine-identities",
  agent: "/developer/agents",
};
