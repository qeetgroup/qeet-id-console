// The deployment's token-signing keys (one key set for every organisation), as published at
// /.well-known/jwks.json. They rotate in the deployment, never from the console.

import { useQuery } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { developerKeys } from "./keys";

// `candidate`: published so apps can cache it, signs nothing yet; `active`: the one key that signs;
// `retired`: signs nothing, still verifies, published until `retire_at`.
export type SigningKey = Answer<"/v1/oidc/signing-keys">["keys"][number];

export function useSigningKeys() {
  return useQuery({
    queryKey: developerKeys.signingKeys(),
    queryFn: () => backend.get("/v1/oidc/signing-keys"),
  });
}
