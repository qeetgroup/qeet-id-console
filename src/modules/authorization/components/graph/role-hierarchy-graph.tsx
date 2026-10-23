import type { Edge, Node } from "@xyflow/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Permission, Role } from "@/modules/authorization/api/rbac";
import { AuthzFlow } from "./authz-flow";
import { rbacNodeTypes } from "./nodes";

/**
 * Renders the roles in one column and the selected role's permissions in the next. The backend
 * has no role inheritance, so this shows real grants rather than a made-up hierarchy.
 */
export function RoleHierarchyGraph({
  roles,
  selectedRoleId,
  permissions,
  onSelectRole,
  height,
}: {
  roles: Role[];
  selectedRoleId: string | null;
  permissions: Permission[];
  onSelectRole?: (roleId: string) => void;
  height?: number;
}) {
  const { t } = useTranslation("authorization");
  const { nodes, edges } = useMemo(() => {
    const roleNodes: Node[] = roles.map((r, i) => ({
      id: `role:${r.id}`,
      type: "role",
      position: { x: 0, y: i * 92 },
      data: {
        name: r.name,
        isSystem: r.is_system,
        selected: r.id === selectedRoleId,
        permCount: r.id === selectedRoleId ? permissions.length : undefined,
      },
    }));
    const permNodes: Node[] = selectedRoleId
      ? permissions.map((p, i) => ({
          id: `perm:${p.id}`,
          type: "permission",
          position: { x: 320, y: i * 78 },
          data: { key: p.key },
        }))
      : [];
    const edges: Edge[] = selectedRoleId
      ? permissions.map((p) => ({
          id: `e-${selectedRoleId}-${p.id}`,
          source: `role:${selectedRoleId}`,
          target: `perm:${p.id}`,
          type: "smoothstep",
        }))
      : [];
    return { nodes: [...roleNodes, ...permNodes], edges };
  }, [roles, selectedRoleId, permissions]);

  return (
    <AuthzFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={rbacNodeTypes}
      height={height}
      ariaLabel={t("roleHierarchyGraph.rbacRoleAndPermissionGraph")}
      onNodeClick={(id) => {
        if (id.startsWith("role:") && onSelectRole) onSelectRole(id.slice("role:".length));
      }}
    />
  );
}
