import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { developerKeys } from "./keys";

export interface SigningKey {
  kid: string;
  alg: string;
  use: string;
  status: "active" | "retired";
}

export function useSigningKeys() {
  return useQuery({
    queryKey: developerKeys.signingKeys(),
    queryFn: () => api<{ keys: SigningKey[] }>("/v1/oidc/signing-keys"),
  });
}
