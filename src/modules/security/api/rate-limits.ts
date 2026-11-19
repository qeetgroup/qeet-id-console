// The organisation's request rate limits: a token bucket per organisation, per person and per
// API key, on every signed-in request. An organisation may lower them, never raise them above the
// platform's; resetting returns them to the platform's. A change applies at once.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

const bucket = z.object({
  rate: z.number(), // requests a second the bucket refills by
  capacity: z.number(), // the burst a full bucket allows
});
const buckets = z.object({ organization: bucket, user: bucket, api_key: bucket });

// The server always sends the effective limits and their bounds (internal/operations/ratelimits,
// limitsView); the document marks them optional (QTID-1063). `ceiling` is the most an
// organisation may set, `defaults` what a reset returns to, `min_rate` the lowest rate it may set.
const limitsSchema = strictly<Answer<"/v1/organizations/{organizationID}/rate-limits">>()(
  buckets.extend({ defaults: buckets, ceiling: buckets, min_rate: z.number() }),
);
export type LimitConfig = z.infer<typeof bucket>;
export type RateLimits = z.infer<typeof limitsSchema>;
export type Bucket = keyof z.infer<typeof buckets>;

export function useRateLimits() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.rateLimits(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/rate-limits", {
        path: { organizationID: organizationId ?? "" },
        schema: limitsSchema,
      }),
    enabled: !!organizationId,
  });
}

export function useUpdateRateLimits() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    // A bucket left out stays as it is.
    mutationFn: (body: Partial<Record<Bucket, LimitConfig>>) =>
      backend.put("/v1/organizations/{organizationID}/rate-limits", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: limitsSchema,
      }),
    onSuccess: (data) => qc.setQueryData(securityKeys.rateLimits(organizationId), data),
    meta: { successMessage: "security:toast.rateLimitsSaved", silentError: true }, // the page shows it
  });
}

export function useResetRateLimits() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      backend.delete("/v1/organizations/{organizationID}/rate-limits", {
        path: { organizationID: organizationId ?? "" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: securityKeys.rateLimits(organizationId) }),
    meta: { successMessage: "security:toast.rateLimitsResetTo" },
  });
}
