import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authzKeys } from "./keys";

/** A Zanzibar-style "object relation subject" assertion; the server resolves them recursively. */
export interface RelationTuple {
  id: string;
  object: string;
  relation: string;
  subject: string;
}

/** Fetches the tuples on `object` ("type:id"); idle until an object is set. */
export function useRelationTuples(object: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.relationTuples(tenantId, object),
    enabled: !!tenantId && !!object,
    queryFn: () =>
      api<{ items: RelationTuple[] }>(
        `/v1/tenants/${tenantId}/relation-tuples?object=${encodeURIComponent(object)}`,
      ),
  });
}

// A tuple change also moves the expanded graph and the subject reverse-lookup.
function invalidateTupleViews(qc: QueryClient, tenantId: string | null) {
  return qc.invalidateQueries({ queryKey: authzKeys.relations(tenantId) });
}

export function useWriteTuple() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { object: string; relation: string; subject: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<RelationTuple>(`/v1/tenants/${tenantId}/relation-tuples`, {
        method: "POST",
        body,
      });
    },
    onSuccess: () => invalidateTupleViews(qc, tenantId),
    meta: { successMessage: "rbac:toast.tupleWritten", silentError: true }, // the page shows the error
  });
}

export function useDeleteTuple() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<void>(`/v1/tenants/${tenantId}/relation-tuples/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => invalidateTupleViews(qc, tenantId),
    meta: { successMessage: "rbac:toast.relationshipDeleted" },
  });
}

export function useCheckRelation() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (body: { object: string; relation: string; user_id: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{ allowed: boolean }>(`/v1/tenants/${tenantId}/relation-tuples/check`, {
        method: "POST",
        body,
      });
    },
    meta: { silent: true },
  });
}

export interface GraphNode {
  id: string; // "type:id"
  type: string; // the type part
  label: string; // the id part
}

export interface GraphEdge {
  from: string; // "type:id"
  to: string; // "type:id"
  relation: string; // named relation (may include "→ userset-rel" suffix)
}

export interface RelationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Fetches the graph of every subject reachable through `relation` on `object`. */
export function useRelationGraph(object: string, relation: string, depth?: number) {
  const tenantId = useTenantId();
  const params = new URLSearchParams({
    object,
    relation,
    ...(depth != null ? { depth: String(depth) } : {}),
  });
  return useQuery({
    queryKey: authzKeys.relationGraph(tenantId, object, relation, depth),
    enabled: !!tenantId && !!object && !!relation,
    queryFn: () => api<RelationGraph>(`/v1/tenants/${tenantId}/relation-tuples/graph?${params}`),
  });
}

/** Fetches every tuple whose subject is `subject`: a reverse lookup. */
export function useSubjectTuples(subject: string) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authzKeys.subjectTuples(tenantId, subject),
    enabled: !!tenantId && !!subject,
    queryFn: () =>
      api<{ items: RelationTuple[] }>(
        `/v1/tenants/${tenantId}/relation-tuples?subject=${encodeURIComponent(subject)}`,
      ),
  });
}
