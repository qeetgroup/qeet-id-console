// The deployment's token-signing keys (one key set for every organisation), as published at
// /.well-known/jwks.json. They rotate in the deployment, never from the console.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { developerKeys } from "./keys";

// The server always sends these (internal/platform/crypto/tokens/keys.go, KeyMeta); the document
// marks them optional. `candidate`: published so apps can cache it, signs nothing yet;
// `active`: the one key that signs; `retired`: signs nothing, still verifies, published until
// `retire_at`.
const signingKey = z.object({
  kid: z.string(),
  alg: z.string(),
  use: z.string(),
  status: z.enum(["active", "candidate", "retired"]),
  retire_at: z.string().optional(),
});
const keySet = strictly<Answer<"/v1/oidc/signing-keys">>()(z.object({ keys: z.array(signingKey) }));
export type SigningKey = z.infer<typeof signingKey>;

export function useSigningKeys() {
  return useQuery({
    queryKey: developerKeys.signingKeys(),
    queryFn: () => backend.get("/v1/oidc/signing-keys", { schema: keySet }),
  });
}
