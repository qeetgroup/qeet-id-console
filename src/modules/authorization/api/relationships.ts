import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { useOrganizationId } from "@/platform/auth/session";
import { authzKeys } from "./keys";
import { assuredItems, strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

/** A Zanzibar-style "object relation subject" assertion; the server resolves them recursively. */
export interface RelationTuple {
  id: string;
  object: string;
  relation: string;
  subject: string;
}

// The server always sends the list; the document marks it optional (QTID-1063).
const tuplePage = assuredItems<Answer<"/v1/organizations/{organizationID}/relation-tuples">>()();

/** Fetches the tuples on `object` ("type:id"); idle until an object is set. */
export function useRelationTuples(object: string) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authzKeys.relationTuples(organizationId, object),
    enabled: !!organizationId && !!object,
    queryFn: () =>
      // As `query`: the console's server refuses a path that carries its own query string.
      backend.get("/v1/organizations/{organizationID}/relation-tuples", {
        path: { organizationID: organizationId ?? "" },
        schema: tuplePage,
        query: { object },
      }),
  });
}

// A tuple change also moves the expanded graph and the subject reverse-lookup.
function invalidateTupleViews(qc: QueryClient, organizationId: string | null) {
  return qc.invalidateQueries({ queryKey: authzKeys.relations(organizationId) });
}

export function useWriteTuple() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { object: string; relation: string; subject: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/relation-tuples", {
        path: { organizationID: organizationId },
        body,
      });
    },
    onSuccess: () => invalidateTupleViews(qc, organizationId),
    meta: { successMessage: "authorization:toast.tupleWritten", silentError: true }, // the page shows the error
  });
}

export function useDeleteTuple() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.delete("/v1/organizations/{organizationID}/relation-tuples/{id}", {
        path: { organizationID: organizationId, id },
      });
    },
    onSuccess: () => invalidateTupleViews(qc, organizationId),
    meta: { successMessage: "authorization:toast.relationshipDeleted" },
  });
}

export function useCheckRelation() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (body: { object: string; relation: string; user_id: string }) => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/relation-tuples/check", {
        path: { organizationID: organizationId },
        body,
      });
    },
    meta: { silent: true },
  });
}

// The server always sends these (internal/access/authorization/rebac/graph.go); the document marks
// them optional (QTID-1063). A graph with no edges answers them null.
const graphNode = z.object({
  id: z.string(), // "type:id"
  type: z.string(), // the type part
  label: z.string(), // the id part
  name: z.string().optional(), // a user node's person, when they belong to the organisation
});
const graphEdge = z.object({
  from: z.string(), // "type:id"
  to: z.string(), // "type:id"
  relation: z.string(), // named relation (may include "→ userset-rel" suffix)
});
const relationGraph = strictly<
  Answer<"/v1/organizations/{organizationID}/relation-tuples/graph">
>()(
  z.object({
    nodes: z.array(graphNode),
    edges: z
      .array(graphEdge)
      .nullable()
      .transform((edges) => edges ?? []),
  }),
);
export type GraphNode = z.infer<typeof graphNode>;
export type GraphEdge = z.infer<typeof graphEdge>;
export type RelationGraph = z.infer<typeof relationGraph>;

/** Fetches the graph of every subject reachable through `relation` on `object`. */
export function useRelationGraph(object: string, relation: string, depth?: number) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authzKeys.relationGraph(organizationId, object, relation, depth),
    enabled: !!organizationId && !!object && !!relation,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/relation-tuples/graph", {
        path: { organizationID: organizationId ?? "" },
        query: { object, relation, depth },
        schema: relationGraph,
      }),
  });
}

/** Fetches every tuple whose subject is `subject`: a reverse lookup. */
export function useSubjectTuples(subject: string) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authzKeys.subjectTuples(organizationId, subject),
    enabled: !!organizationId && !!subject,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/relation-tuples", {
        path: { organizationID: organizationId ?? "" },
        schema: tuplePage,
        query: { subject },
      }),
  });
}
