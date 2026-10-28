// The deployment's token-signing keys (one key set for every organisation), as published at
// /.well-known/jwks.json. They rotate in the deployment, never from the console.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { developerKeys } from "./keys";

export interface SigningKey {
  kid: string;
  alg: string;
  use: string;
  /**
   * `candidate`: published so apps can cache it, signs nothing yet; `active`: the one key that
   * signs; `retired`: signs nothing, still verifies, published until `retire_at`.
   */
  status: "active" | "candidate" | "retired";
  retire_at?: string;
}

export function useSigningKeys() {
  return useQuery({
    queryKey: developerKeys.signingKeys(),
    queryFn: () => api<{ keys: SigningKey[] }>("/v1/oidc/signing-keys"),
  });
}
