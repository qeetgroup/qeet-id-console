import { useQuery } from "@tanstack/react-query";
export const SIGNING_KEYS_KEY = ["signing-keys"] as const;

import { api } from "@/platform/api/client";

export interface SigningKey {
  kid: string;
  alg: string;
  use: string;
  status: "active" | "retired";
}

export function useSigningKeys() {
  return useQuery({
    queryKey: SIGNING_KEYS_KEY,
    queryFn: () => api<{ keys: SigningKey[] }>("/v1/oidc/signing-keys"),
  });
}
